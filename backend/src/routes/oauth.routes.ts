import type { Role } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import { env, oauthConfig } from '../config/env';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/publicUser';
import { oauthLimiter } from '../middleware/rateLimit';
import { setSessionCookie } from '../lib/sessionCookie';
import { getPlatformSettings } from '../services/platformSettings.service';
import { createSession } from '../services/session.service';
import { recordSecurityEvent, requestSecurityContext } from '../services/security.service';

type ProviderName = 'google' | 'facebook';
type RegistrationRole = Extract<Role, 'OWNER' | 'BOARDER'>;

const PROVIDER_LABELS: Record<ProviderName, string> = { google: 'Google', facebook: 'Facebook' };
const STATE_COOKIE_PREFIX = 'stayfinder_oauth_state_';
const STATE_TTL_MS = 10 * 60 * 1000;
const CALLBACK_FAILURE = '/login?oauthError=failed';
const CALLBACK_ACCOUNT_EXISTS = '/login?oauthError=account_exists';

// Thrown when the provider identity matches an existing local account that
// must not be linked automatically (unverified provider email, or an admin
// account). Redirects to a page telling the visitor to log in with a password.
class AccountLinkConflict extends Error {}

function isProvider(value: string): value is ProviderName {
  return value === 'google' || value === 'facebook';
}

function isConfigured(provider: ProviderName): boolean {
  const { clientId, clientSecret, callbackUrl } = oauthConfig[provider];
  return Boolean(clientId && clientSecret && callbackUrl && isAllowedCallbackUrl(callbackUrl));
}

function isAllowedCallbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ||
      (!env.isProduction && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.isProduction,
    path: '/api/auth/oauth',
    maxAge: STATE_TTL_MS,
  };
}

function clearStateCookie(res: import('express').Response, cookieName: string) {
  const options = stateCookieOptions();
  res.clearCookie(cookieName, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
  });
}

function readRole(value: unknown): RegistrationRole {
  return value === 'OWNER' ? 'OWNER' : 'BOARDER';
}

function isRole(value: unknown): value is RegistrationRole {
  return value === 'OWNER' || value === 'BOARDER';
}

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function matchesState(expected: string | undefined, actual: unknown): actual is string {
  if (!expected || typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

function frontendRedirect(path: string): string {
  return new URL(path, env.frontendUrl).toString();
}

interface ProviderIdentity {
  id: string;
  name: string;
  email: string;
  // Only identities whose email the provider itself verified may be linked to
  // an existing account. Facebook never verifies, so it stays false there.
  emailVerified: boolean;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !data) {
    throw new Error(`OAuth provider request failed with status ${response.status}.`);
  }
  return data;
}

async function exchangeCode(provider: ProviderName, code: string): Promise<ProviderIdentity> {
  const config = oauthConfig[provider];
  if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
    throw new Error(`${PROVIDER_LABELS[provider]} OAuth credentials are incomplete.`);
  }

  if (provider === 'google') {
    const token = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    if (typeof token.access_token !== 'string') throw new Error('Google did not return an access token.');
    const profile = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: ['Bearer', token.access_token].join(' ') },
    });
    if (typeof profile.sub !== 'string' || typeof profile.email !== 'string' ||
        profile.email_verified !== true || typeof profile.name !== 'string') {
      throw new Error('Google profile is missing a verified email or required identity fields.');
    }
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email.trim().toLowerCase(),
      emailVerified: true,
    };
  }

  const graphBaseUrl = `https://graph.facebook.com/${oauthConfig.facebook.graphApiVersion}`;
  const tokenUrl = new URL(`${graphBaseUrl}/oauth/access_token`);
  tokenUrl.search = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
  }).toString();
  const token = await fetchJson(tokenUrl.toString());
  if (typeof token.access_token !== 'string') throw new Error('Facebook did not return an access token.');
  const profileUrl = new URL(`${graphBaseUrl}/me`);
  profileUrl.search = new URLSearchParams({
    fields: 'id,name,email,picture',
    access_token: token.access_token,
  }).toString();
  const profile = await fetchJson(profileUrl.toString());
  if (typeof profile.id !== 'string' || typeof profile.email !== 'string' || typeof profile.name !== 'string') {
    throw new Error('Facebook profile is missing an email or required identity fields.');
  }
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email.trim().toLowerCase(),
    // The Facebook Graph API does not attest that the email is verified.
    emailVerified: false,
  };
}

async function findOrCreateOAuthUser(
  provider: ProviderName,
  identity: ProviderIdentity,
  role: RegistrationRole,
) {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: identity.id,
      },
    },
    select: { user: { select: publicUserSelect } },
  });
  if (linked) return linked.user;

  const existingUser = await prisma.user.findUnique({
    where: { email: identity.email },
    select: { id: true, role: true },
  });
  // An OAuth identity may only claim an existing account when its email was
  // verified by the provider (Google) and the account is not an administrator.
  // Facebook clients cannot verify, so a matching password account must never
  // be linked; ask the visitor to log in with the password instead.
  if (existingUser && (!identity.emailVerified || existingUser.role === 'ADMIN')) {
    throw new AccountLinkConflict();
  }
  if (!existingUser && !(await getPlatformSettings()).allowRegistrations) {
    throw new Error('New account registration is currently disabled.');
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = existingUser
        ? await transaction.user.findUniqueOrThrow({ where: { id: existingUser.id }, select: publicUserSelect })
        : await transaction.user.create({
            data: {
              name: identity.name,
              email: identity.email,
              role,
              // Provider avatar URLs are not trusted; users can upload an
              // avatar themselves after signing in.
              avatarUrl: null,
            },
            select: publicUserSelect,
          });
      await transaction.oAuthAccount.create({
        data: { provider, providerAccountId: identity.id, userId: user.id },
      });
      return user;
    });
  } catch (error) {
    const linkedAfterConflict = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: identity.id,
        },
      },
      select: { user: { select: publicUserSelect } },
    });
    if (linkedAfterConflict) return linkedAfterConflict.user;
    throw error;
  }
}

export const oauthRouter = Router();

oauthRouter.use(oauthLimiter);

// GET /api/auth/oauth/providers - lets the frontend know what is available
oauthRouter.get('/providers', (_req, res) => {
  res.json({
    status: 'ok',
    providers: {
      google: { configured: isConfigured('google'), enabled: isConfigured('google') },
      facebook: { configured: isConfigured('facebook'), enabled: isConfigured('facebook') },
    },
  });
});

oauthRouter.get('/:provider', (req, res) => {
  const { provider } = req.params;
  if (!isProvider(provider)) {
    res.status(404).json({ status: 'error', message: 'Unknown sign-in provider.' });
    return;
  }
  if (!isConfigured(provider)) {
    res.status(503).json({ status: 'error', message: `${PROVIDER_LABELS[provider]} sign-in is not configured.` });
    return;
  }
  const requestedRole = req.query.role;
  if (requestedRole !== undefined && !isRole(requestedRole)) {
    res.status(400).json({ status: 'error', message: 'Account type must be OWNER or BOARDER.' });
    return;
  }
  const state = randomBytes(32).toString('hex');
  const role = requestedRole === undefined ? 'BOARDER' : readRole(requestedRole);
  res.cookie(`${STATE_COOKIE_PREFIX}${provider}`, `${state}:${role}`, stateCookieOptions());

  const config = oauthConfig[provider];
  const authorizationUrl = provider === 'google'
    ? new URL('https://accounts.google.com/o/oauth2/v2/auth')
    : new URL(`https://www.facebook.com/${oauthConfig.facebook.graphApiVersion}/dialog/oauth`);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.callbackUrl!,
    response_type: 'code',
    scope: provider === 'google' ? 'openid email profile' : 'email,public_profile',
    state,
  }).toString();
  res.redirect(302, authorizationUrl.toString());
});

oauthRouter.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  if (!isProvider(provider)) {
    res.status(404).json({ status: 'error', message: 'Unknown sign-in provider.' });
    return;
  }
  const cookieName = `${STATE_COOKIE_PREFIX}${provider}`;
  const stateCookie = getCookie(req, cookieName);
  clearStateCookie(res, cookieName);
  const [expectedState, roleValue] = stateCookie?.split(':') ?? [];
  if (!matchesState(expectedState, req.query.state)) {
    res.redirect(302, frontendRedirect(CALLBACK_FAILURE));
    return;
  }
  if (typeof req.query.error === 'string' || typeof req.query.code !== 'string') {
    res.redirect(302, frontendRedirect(CALLBACK_FAILURE));
    return;
  }
  if (!isConfigured(provider)) {
    res.redirect(302, frontendRedirect(CALLBACK_FAILURE));
    return;
  }

  try {
    const identity = await exchangeCode(provider, req.query.code);
    const user = await findOrCreateOAuthUser(provider, identity, readRole(roleValue));
    const context = requestSecurityContext(req);
    const session = await createSession(user.id, context);
    await recordSecurityEvent({
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      target: `${PROVIDER_LABELS[provider]} sign-in`,
      userId: user.id,
      userName: user.name,
      email: user.email,
      role: user.role,
      ...context,
    });
    setSessionCookie(res, session.token, session.expiresAt);
    res.redirect(302, frontendRedirect('/auth/callback'));
  } catch (error) {
    if (error instanceof AccountLinkConflict) {
      res.redirect(302, frontendRedirect(CALLBACK_ACCOUNT_EXISTS));
      return;
    }
    console.error(`${PROVIDER_LABELS[provider]} OAuth callback failed (${error instanceof Error ? error.name : 'unknown error'}).`);
    res.redirect(302, frontendRedirect(CALLBACK_FAILURE));
  }
});
