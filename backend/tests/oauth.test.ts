import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const TEST_DATABASE_URL = 'file:./test-oauth.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

describe('Phase 10 OAuth sign-in', () => {
  let server: Server;
  let baseUrl = '';
  let prisma: typeof import('../src/lib/prisma').prisma;
  let config: typeof import('../src/config/env').oauthConfig;
  let originalFetch: typeof fetch;
  let providerProfile: Record<string, unknown>;

  async function request(pathname: string, cookie?: string) {
    return fetch(`${baseUrl}${pathname}`, {
      redirect: 'manual',
      headers: cookie ? { Cookie: cookie } : undefined,
    });
  }

  async function start(provider: 'google' | 'facebook', role?: 'OWNER' | 'BOARDER') {
    const response = await request(`/api/auth/oauth/${provider}${role ? `?role=${role}` : ''}`);
    assert.equal(response.status, 302);
    const location = new URL(response.headers.get('location')!);
    const stateCookie = response.headers.getSetCookie()
      .find((cookie) => cookie.startsWith(`stayfinder_oauth_state_${provider}=`));
    assert.ok(stateCookie, 'OAuth state cookie should be set');
    return {
      state: location.searchParams.get('state')!,
      stateCookie: stateCookie.split(';')[0],
      authorizationUrl: location,
    };
  }

  async function finish(
    provider: 'google' | 'facebook',
    state: string,
    stateCookie: string,
  ) {
    const response = await request(
      `/api/auth/oauth/${provider}/callback?code=test-code&state=${encodeURIComponent(state)}`,
      stateCookie,
    );
    return response;
  }

  before(async () => {
    const backendDir = path.resolve(__dirname, '..');
    const testDbFile = path.join(backendDir, 'prisma', 'test-oauth.db');
    for (const file of [testDbFile, `${testDbFile}-journal`]) fs.rmSync(file, { force: true });
    execSync('npx prisma db push --skip-generate', {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
    assert.ok(fs.existsSync(testDbFile), 'OAuth test database was not created.');

    ({ prisma } = await import('../src/lib/prisma'));
    ({ oauthConfig: config } = await import('../src/config/env'));
    const { createApp } = await import('../src/app');
    config.google.clientId = 'google-test-client';
    config.google.clientSecret = 'google-test-secret';
    config.google.callbackUrl = 'http://localhost:4000/api/auth/oauth/google/callback';
    config.facebook.clientId = 'facebook-test-client';
    config.facebook.clientSecret = 'facebook-test-secret';
    config.facebook.callbackUrl = 'http://localhost:4000/api/auth/oauth/facebook/callback';
    config.facebook.graphApiVersion = 'v22.0';

    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith('http://127.0.0.1')) return originalFetch(input, init);
      if (url === 'https://oauth2.googleapis.com/token' ||
          url.startsWith(`https://graph.facebook.com/${config.facebook.graphApiVersion}/oauth/access_token`)) {
        return new Response(JSON.stringify({ access_token: 'test-provider-access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
        return new Response(JSON.stringify(providerProfile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith(`https://graph.facebook.com/${config.facebook.graphApiVersion}/me?`)) {
        return new Response(JSON.stringify(providerProfile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected OAuth provider request: ${url}`);
    };

    server = createApp().listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    globalThis.fetch = originalFetch;
    await prisma?.$disconnect();
  });

  it('uses state validation and Google verified profile data to create a session', async () => {
    providerProfile = {
      sub: 'google-sub-001',
      name: 'Google Owner',
      email: 'Google.Owner@example.com',
      email_verified: true,
      picture: 'https://example.com/google-avatar.jpg',
    };

    const flow = await start('google', 'OWNER');
    assert.equal(flow.authorizationUrl.origin, 'https://accounts.google.com');
    assert.ok(flow.authorizationUrl.searchParams.get('scope')?.includes('email'));
    const callback = await finish('google', flow.state, flow.stateCookie);
    assert.equal(callback.status, 302);
    assert.equal(new URL(callback.headers.get('location')!).pathname, '/auth/callback');
    const sessionCookie = callback.headers.getSetCookie()
      .find((cookie) => cookie.startsWith('stayfinder_session='))
      ?.split(';')[0];
    assert.ok(sessionCookie, 'successful OAuth should set the app session cookie');

    const current = await request('/api/auth/me', sessionCookie);
    const user = (await current.json() as { user: { name: string; email: string; role: string; avatarUrl: string | null } }).user;
    assert.equal(user.name, 'Google Owner');
    assert.equal(user.email, 'google.owner@example.com');
    assert.equal(user.role, 'OWNER');
    assert.equal(user.avatarUrl, 'https://example.com/google-avatar.jpg');
    assert.equal(await prisma.oAuthAccount.count({ where: { provider: 'google', providerAccountId: 'google-sub-001' } }), 1);
    assert.equal(await prisma.user.count({ where: { email: user.email } }), 1);

    const secondFlow = await start('google', 'BOARDER');
    const secondCallback = await finish('google', secondFlow.state, secondFlow.stateCookie);
    assert.equal(secondCallback.status, 302);
    assert.equal(await prisma.user.count({ where: { email: user.email } }), 1);
    const signedIn = await request('/api/auth/me', secondCallback.headers.getSetCookie()
      .find((cookie) => cookie.startsWith('stayfinder_session='))?.split(';')[0]);
    assert.equal((await signedIn.json() as { user: { role: string } }).user.role, 'OWNER');
  });

  it('supports Facebook sign-in and honors the selected registration role', async () => {
    providerProfile = {
      id: 'facebook-id-123',
      name: 'Facebook Boarder',
      email: 'boarder.facebook@example.com',
      picture: { data: { url: 'https://example.com/facebook-avatar.jpg' } },
    };
    const flow = await start('facebook', 'BOARDER');
    assert.equal(flow.authorizationUrl.origin, 'https://www.facebook.com');
    const callback = await finish('facebook', flow.state, flow.stateCookie);
    assert.equal(callback.status, 302);
    const sessionCookie = callback.headers.getSetCookie()
      .find((cookie) => cookie.startsWith('stayfinder_session='))?.split(';')[0];
    assert.ok(sessionCookie);
    const response = await request('/api/auth/me', sessionCookie);
    const user = (await response.json() as { user: { role: string; email: string; avatarUrl: string | null } }).user;
    assert.equal(user.role, 'BOARDER');
    assert.equal(user.email, 'boarder.facebook@example.com');
    assert.equal(user.avatarUrl, 'https://example.com/facebook-avatar.jpg');
  });

  it('links a provider-verified email to an existing non-admin account', async () => {
    const existing = await prisma.user.create({
      data: { name: 'Existing Owner', email: 'existing.owner@example.com', role: 'OWNER', passwordHash: 'test-hash' },
    });
    providerProfile = {
      sub: 'google-linked-owner',
      name: 'Provider Display Name',
      email: 'EXISTING.OWNER@example.com',
      email_verified: true,
    };
    const flow = await start('google', 'BOARDER');
    const callback = await finish('google', flow.state, flow.stateCookie);
    const sessionCookie = callback.headers.getSetCookie()
      .find((cookie) => cookie.startsWith('stayfinder_session='))?.split(';')[0];
    assert.ok(sessionCookie);
    const current = await request('/api/auth/me', sessionCookie);
    const user = (await current.json() as { user: { id: string; role: string } }).user;
    assert.equal(user.id, existing.id);
    assert.equal(user.role, 'OWNER');
    assert.equal(await prisma.user.count({ where: { email: existing.email } }), 1);
  });

  it('rejects unsupported account roles before redirecting to a provider', async () => {
    const response = await request('/api/auth/oauth/google?role=ADMIN');
    assert.equal(response.status, 400);
  });

  it('never links an unverified Facebook email to an existing password account', async () => {
    const existing = await prisma.user.create({
      data: { name: 'Facebook Victim', email: 'facebook.victim@example.com', role: 'OWNER', passwordHash: 'test-hash' },
    });
    const userCountBefore = await prisma.user.count();
    const accountCountBefore = await prisma.oAuthAccount.count();

    providerProfile = {
      id: 'facebook-id-victim',
      name: 'Facebook Victim',
      email: 'facebook.victim@example.com',
      picture: { data: { url: 'https://example.com/facebook-avatar.jpg' } },
    };
    const flow = await start('facebook', 'BOARDER');
    const callback = await finish('facebook', flow.state, flow.stateCookie);

    assert.equal(callback.status, 302);
    const callbackUrl = new URL(callback.headers.get('location')!);
    assert.equal(callbackUrl.pathname, '/login');
    assert.equal(callbackUrl.searchParams.get('oauthError'), 'account_exists');
    assert.equal(
      callback.headers.getSetCookie().some((cookie) => cookie.startsWith('stayfinder_session=')),
      false,
      'no session may be created when the email already belongs to a password account',
    );

    // Neither a second user nor a link may exist - the takeover was blocked.
    assert.equal(await prisma.user.count(), userCountBefore);
    assert.equal(await prisma.user.count({ where: { email: existing.email } }), 1);
    assert.equal(await prisma.oAuthAccount.count(), accountCountBefore);
    assert.equal(await prisma.oAuthAccount.count({ where: { providerAccountId: 'facebook-id-victim' } }), 0);
  });

  it('never links an OAuth identity to an ADMIN account', async () => {
    const adminEmail = 'admin.takeover@example.com';
    await prisma.user.create({
      data: { name: 'Takeover Admin', email: adminEmail, role: 'ADMIN', passwordHash: 'test-hash' },
    });
    const userCountBefore = await prisma.user.count();
    const accountCountBefore = await prisma.oAuthAccount.count();

    providerProfile = {
      id: 'facebook-id-admin',
      name: 'Takeover Admin',
      email: adminEmail,
    };
    const facebookFlow = await start('facebook', 'BOARDER');
    const facebookCallback = await finish('facebook', facebookFlow.state, facebookFlow.stateCookie);
    assert.equal(new URL(facebookCallback.headers.get('location')!).searchParams.get('oauthError'), 'account_exists');
    assert.equal(
      facebookCallback.headers.getSetCookie().some((cookie) => cookie.startsWith('stayfinder_session=')),
      false,
    );

    providerProfile = {
      sub: 'google-id-admin',
      name: 'Takeover Admin',
      email: adminEmail,
      email_verified: true,
    };
    const googleFlow = await start('google', 'BOARDER');
    const googleCallback = await finish('google', googleFlow.state, googleFlow.stateCookie);
    assert.equal(new URL(googleCallback.headers.get('location')!).searchParams.get('oauthError'), 'account_exists');
    assert.equal(
      googleCallback.headers.getSetCookie().some((cookie) => cookie.startsWith('stayfinder_session=')),
      false,
    );

    // Accounts row unchanged: no session, no linking, no new users.
    assert.equal(await prisma.user.count(), userCountBefore);
    assert.equal(await prisma.oAuthAccount.count(), accountCountBefore);
  });

  it('rejects invalid state and unverified Google email without creating accounts', async () => {
    const beforeCount = await prisma.user.count();
    const invalidState = await request('/api/auth/oauth/google/callback?code=test-code&state=0000000000000000000000000000000000000000000000000000000000000000');
    assert.equal(invalidState.status, 302);
    assert.equal(new URL(invalidState.headers.get('location')!).searchParams.get('oauthError'), 'failed');
    assert.equal(await prisma.user.count(), beforeCount);

    providerProfile = {
      sub: 'google-unverified',
      name: 'Unverified User',
      email: 'unverified@example.com',
      email_verified: false,
    };
    const flow = await start('google');
    const callback = await finish('google', flow.state, flow.stateCookie);
    assert.equal(callback.status, 302);
    assert.equal(await prisma.user.count(), beforeCount);

    await prisma.user.create({
      data: { name: 'Social Admin', email: 'social-admin@example.com', role: 'ADMIN' },
    });
    providerProfile = {
      sub: 'google-admin-match',
      name: 'Social Admin',
      email: 'social-admin@example.com',
      email_verified: true,
    };
    const adminFlow = await start('google');
    const adminCallback = await finish('google', adminFlow.state, adminFlow.stateCookie);
    assert.equal(adminCallback.status, 302);
    assert.equal(adminCallback.headers.getSetCookie().some((cookie) => cookie.startsWith('stayfinder_session=')), false);
    assert.equal(await prisma.oAuthAccount.count({ where: { providerAccountId: 'google-admin-match' } }), 0);
  });
});
