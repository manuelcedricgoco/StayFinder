import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { getDummyHash, hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { publicUserSelect, toPublicUser } from '../lib/publicUser';
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/sessionCookie';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { createSession, deleteSession, findUserBySessionToken } from '../services/session.service';
import { getPlatformSettings } from '../services/platformSettings.service';
import { isLoginThrottled, recordSecurityEvent, requestSecurityContext } from '../services/security.service';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '../validators/auth.validators';
import { oauthRouter } from './oauth.routes';

export const authRouter = Router();

// POST /api/auth/register - create an OWNER or BOARDER account and log them in
authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body as RegisterInput;
    const settings = await getPlatformSettings();
    if (!settings.allowRegistrations) {
      res.status(403).json({ status: 'error', message: 'New account registration is currently disabled.' });
      return;
    }
    const passwordHash = await hashPassword(password);

    try {
      const user = await prisma.user.create({
        data: { name, email, passwordHash, role },
        select: publicUserSelect,
      });
      const context = requestSecurityContext(req);
      const session = await createSession(user.id, context);
      await recordSecurityEvent({
        action: 'ACCOUNT_CREATED',
        status: 'SUCCESS',
        target: 'Account',
        userId: user.id,
        userName: user.name,
        email: user.email,
        role: user.role,
        ...context,
      });
      await recordSecurityEvent({
        action: 'LOGIN_SUCCESS',
        status: 'SUCCESS',
        target: 'Password sign-in',
        userId: user.id,
        userName: user.name,
        email: user.email,
        role: user.role,
        ...context,
      });
      setSessionCookie(res, session.token, session.expiresAt);
      res.status(201).json({ status: 'ok', user });
    } catch (error) {
      // P2002 = unique constraint failed (email already registered)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
          status: 'error',
          message: 'An account with this email already exists.',
          errors: [{ field: 'email', message: 'An account with this email already exists.' }],
        });
        return;
      }
      throw error;
    }
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;

    // Per-account brute-force protection: stop before any scrypt work. The
    // message stays generic so it leaks nothing about which emails are real.
    if (await isLoginThrottled(email)) {
      res.status(429).json({
        status: 'error',
        message: 'Too many failed login attempts. Please try again later.',
      });
      return;
    }

    const record = await prisma.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, passwordHash: true },
    });

    // Always run one password check (even for unknown emails) and always return the
    // same message, so attackers cannot tell which emails are registered.
    const storedHash = record?.passwordHash ?? (await getDummyHash());
    const passwordMatches = await verifyPassword(password, storedHash);

    if (!record || !record.passwordHash || !passwordMatches) {
      const context = requestSecurityContext(req);
      await recordSecurityEvent({
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        target: 'Password sign-in',
        userId: record?.id,
        userName: record?.name,
        email,
        role: record?.role,
        ...context,
      });
      res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
      return;
    }

    const user = toPublicUser(record);
    const context = requestSecurityContext(req);
    const session = await createSession(user.id, context);
    await recordSecurityEvent({
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      target: 'Password sign-in',
      userId: user.id,
      userName: user.name,
      email: user.email,
      role: user.role,
      ...context,
    });
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ status: 'ok', user });
  }),
);

// POST /api/auth/logout - destroys the session on the server, then clears the cookie
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    if (token) {
      const user = await findUserBySessionToken(token);
      if (user) {
        await recordSecurityEvent({
          action: 'LOGOUT',
          status: 'SUCCESS',
          target: 'Session',
          userId: user.id,
          userName: user.name,
          email: user.email,
          role: user.role,
          ...requestSecurityContext(req),
        });
      }
      await deleteSession(token);
    }
    clearSessionCookie(res);
    res.json({ status: 'ok' });
  }),
);

// GET /api/auth/me - who is logged in right now?
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ status: 'ok', user: req.user });
});

// Google / Facebook (structure only for now)
authRouter.use('/oauth', oauthRouter);
