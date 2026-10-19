// Integration tests for Phase 3 (registration, login, logout, protected routes, roles).
// Run with: npm test
// They use a separate SQLite file (backend/prisma/test.db), never your dev.db.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const TEST_DATABASE_URL = 'file:./test.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

// Minimal HTTP client that behaves like a browser: it remembers the session cookie.
class TestClient {
  cookie = '';
  constructor(private baseUrl: string) {}

  async request(method: string, url: string, body?: unknown) {
    const response = await fetch(this.baseUrl + url, {
      method,
      headers: {
        'User-Agent': 'StayFinder Test Browser',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookies = response.headers.getSetCookie();
    const sessionCookie = setCookies.find((c) => c.startsWith('stayfinder_session='));
    if (sessionCookie) {
      const pair = sessionCookie.split(';')[0];
      // Cleared cookies come back empty; a browser would delete them.
      this.cookie = pair.endsWith('=') ? '' : pair;
    }

    const data: any = response.headers.get('content-type')?.includes('application/json')
      ? (await response.json().catch(() => null)) as Record<string, any> | null
      : await response.text();
    return { status: response.status, data, setCookies };
  }
}

describe('Phase 3 authentication', () => {
  let server: Server;
  let baseUrl = '';
  let prisma: typeof import('../src/lib/prisma').prisma;
  let hashPassword: typeof import('../src/lib/password').hashPassword;
  let deleteStaleSessions: typeof import('../src/services/session.service').deleteStaleSessions;

  const owner = { name: 'Olivia Owner', email: 'owner@example.com', password: 'Passw0rd123', role: 'OWNER' };
  const boarder = { name: 'Ben Boarder', email: 'boarder@example.com', password: 'Passw0rd123', role: 'BOARDER' };
  const admin = { name: 'Ada Admin', email: 'admin@example.com', password: 'Passw0rd123' };

  const newClient = () => new TestClient(baseUrl);

  before(async () => {
    // Start from a brand-new test database file (never a reset of anything else).
    const backendDir = path.resolve(__dirname, '..');
    const testDbFile = path.join(backendDir, 'prisma', 'test.db');
    for (const file of [testDbFile, `${testDbFile}-journal`]) fs.rmSync(file, { force: true });

    execSync('npx prisma db push --skip-generate', {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
    // Safety net: if the Prisma CLI ignored our DATABASE_URL, this file would not exist
    // and we stop BEFORE any test writes data anywhere else.
    assert.ok(fs.existsSync(testDbFile), 'Test database was not created - aborting.');

    // Import AFTER DATABASE_URL is set so the app and Prisma use the test database.
    ({ prisma } = await import('../src/lib/prisma'));
    ({ hashPassword } = await import('../src/lib/password'));
    ({ deleteStaleSessions } = await import('../src/services/session.service'));
    const { createApp } = await import('../src/app');

    server = createApp().listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await prisma.user.create({
      data: { name: admin.name, email: admin.email, role: 'ADMIN', passwordHash: await hashPassword(admin.password) },
    });
  });

  after(async () => {
    server?.close();
    await prisma?.$disconnect();
  });

  describe('registration', () => {
    it('registers an owner, logs them in, and never exposes the password', async () => {
      const client = newClient();
      const res = await client.request('POST', '/api/auth/register', owner);

      assert.equal(res.status, 201);
      assert.equal(res.data?.user.email, owner.email);
      assert.equal(res.data?.user.role, 'OWNER');
      assert.ok(!('passwordHash' in res.data!.user) && !('password' in res.data!.user));
      assert.ok(!JSON.stringify(res.data).includes(owner.password));

      const cookie = res.setCookies.find((c) => c.startsWith('stayfinder_session='))!;
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
    });

    it('stores a scrypt hash, not the plain-text password', async () => {
      const stored = await prisma.user.findUniqueOrThrow({ where: { email: owner.email } });
      assert.notEqual(stored.passwordHash, owner.password);
      assert.ok(stored.passwordHash?.startsWith('scrypt$'));
    });

    it('registers a boarder', async () => {
      const res = await newClient().request('POST', '/api/auth/register', boarder);
      assert.equal(res.status, 201);
      assert.equal(res.data?.user.role, 'BOARDER');
    });

    it('rejects a duplicate email (case-insensitive)', async () => {
      const res = await newClient().request('POST', '/api/auth/register', {
        ...owner,
        email: owner.email.toUpperCase(),
      });
      assert.equal(res.status, 409);
    });

    it('does not allow registering as ADMIN', async () => {
      const res = await newClient().request('POST', '/api/auth/register', {
        ...owner,
        email: 'sneaky@example.com',
        role: 'ADMIN',
      });
      assert.equal(res.status, 400);
      assert.equal(await prisma.user.count({ where: { email: 'sneaky@example.com' } }), 0);
    });

    it('rejects invalid input with field errors', async () => {
      const res = await newClient().request('POST', '/api/auth/register', {
        name: 'A',
        email: 'not-an-email',
        password: 'short',
        role: 'BOARDER',
      });
      assert.equal(res.status, 400);
      // One field can break several rules at once ("short" is too short AND has no number),
      // so compare the distinct field names.
      const fields = [...new Set((res.data?.errors as { field: string }[]).map((e) => e.field))].sort();
      assert.deepEqual(fields, ['email', 'name', 'password']);
    });

    it('rejects malformed JSON with 400', async () => {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      });
      assert.equal(response.status, 400);
    });
  });

  describe('login and logout', () => {
    it('logs in with correct credentials and /me returns the user', async () => {
      const client = newClient();
      const login = await client.request('POST', '/api/auth/login', {
        email: owner.email,
        password: owner.password,
      });
      assert.equal(login.status, 200);
      assert.ok(!('passwordHash' in login.data!.user));

      const me = await client.request('GET', '/api/auth/me');
      assert.equal(me.status, 200);
      assert.equal(me.data?.user.email, owner.email);
    });

    it('accepts the email in a different letter case', async () => {
      const res = await newClient().request('POST', '/api/auth/login', {
        email: '  OWNER@Example.com ',
        password: owner.password,
      });
      assert.equal(res.status, 200);
    });

    it('rejects a wrong password and an unknown email with the same message', async () => {
      const wrongPassword = await newClient().request('POST', '/api/auth/login', {
        email: owner.email,
        password: 'WrongPass999',
      });
      const unknownEmail = await newClient().request('POST', '/api/auth/login', {
        email: 'nobody@example.com',
        password: 'Passw0rd123',
      });
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownEmail.status, 401);
      assert.equal(wrongPassword.data?.message, unknownEmail.data?.message);
      assert.equal(wrongPassword.setCookies.length, 0);
    });

    it('logs out: /me fails afterwards and the old cookie is dead on the server', async () => {
      const client = newClient();
      await client.request('POST', '/api/auth/login', { email: owner.email, password: owner.password });
      const oldCookie = client.cookie;
      assert.ok(oldCookie);

      const logout = await client.request('POST', '/api/auth/logout');
      assert.equal(logout.status, 200);
      assert.equal((await client.request('GET', '/api/auth/me')).status, 401);

      // Replay the stolen/old cookie: the session no longer exists server-side.
      const replay = newClient();
      replay.cookie = oldCookie;
      assert.equal((await replay.request('GET', '/api/auth/me')).status, 401);
    });
  });

  describe('protected routes', () => {
    it('rejects requests without a session', async () => {
      const client = newClient();
      for (const url of ['/api/auth/me', '/api/admin', '/api/owner', '/api/boarder']) {
        assert.equal((await client.request('GET', url)).status, 401, url);
      }
    });

    it('rejects a forged or tampered session cookie', async () => {
      const client = newClient();
      client.cookie = `stayfinder_session=${'a'.repeat(64)}`;
      assert.equal((await client.request('GET', '/api/auth/me')).status, 401);
      client.cookie = 'stayfinder_session=not-a-real-token';
      assert.equal((await client.request('GET', '/api/auth/me')).status, 401);
    });

    it('rejects an expired session', async () => {
      const client = newClient();
      await client.request('POST', '/api/auth/login', { email: owner.email, password: owner.password });
      await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await client.request('GET', '/api/auth/me')).status, 401);
    });

    it('rejects a session idle for more than the limit and removes it from the database', async () => {
      const client = newClient();
      const login = await client.request('POST', '/api/auth/login', { email: owner.email, password: owner.password });
      assert.equal(login.status, 200);
      const session = await prisma.session.findFirstOrThrow({
        where: { user: { email: owner.email } },
        orderBy: { createdAt: 'desc' },
      });

      // The 24-hour idle limit leaves this session untouched...
      await prisma.session.updateMany({ data: { lastActivityAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });

      assert.equal((await client.request('GET', '/api/auth/me')).status, 401);
      assert.equal(await prisma.session.findUnique({ where: { id: session.id } }), null);
    });

    it('keeps serving an active session', async () => {
      const client = newClient();
      const login = await client.request('POST', '/api/auth/login', { email: owner.email, password: owner.password });
      assert.equal(login.status, 200);
      const me = await client.request('GET', '/api/auth/me');
      assert.equal(me.status, 200);
      assert.equal(me.data?.user.email, owner.email);
    });

    it('cleanup deletes expired and idle sessions and keeps valid ones', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: owner.email } });
      const now = Date.now();
      const [expired, idle, valid] = await prisma.$transaction([
        prisma.session.create({
          data: { tokenHash: 'cleanup-expired-hash', userId: user.id, expiresAt: new Date(now - 1000), lastActivityAt: new Date(now) },
        }),
        prisma.session.create({
          data: {
            tokenHash: 'cleanup-idle-hash',
            userId: user.id,
            expiresAt: new Date(now + 24 * 60 * 60 * 1000),
            lastActivityAt: new Date(now - 25 * 60 * 60 * 1000),
          },
        }),
        prisma.session.create({
          data: {
            tokenHash: 'cleanup-valid-hash',
            userId: user.id,
            expiresAt: new Date(now + 24 * 60 * 60 * 1000),
            lastActivityAt: new Date(now),
          },
        }),
      ]);

      const removed = await deleteStaleSessions(new Date(now));
      assert.ok(removed >= 2);
      assert.equal(await prisma.session.findUnique({ where: { id: expired.id } }), null);
      assert.equal(await prisma.session.findUnique({ where: { id: idle.id } }), null);
      assert.ok(await prisma.session.findUnique({ where: { id: valid.id } }));
    });
  });

  describe('role restrictions', () => {
    async function loggedIn(email: string, password: string) {
      const client = newClient();
      const res = await client.request('POST', '/api/auth/login', { email, password });
      assert.equal(res.status, 200);
      return client;
    }

    it('lets a boarder into /boarder only', async () => {
      const client = await loggedIn(boarder.email, boarder.password);
      assert.equal((await client.request('GET', '/api/boarder')).status, 200);
      assert.equal((await client.request('GET', '/api/owner')).status, 403);
      assert.equal((await client.request('GET', '/api/admin')).status, 403);
    });

    it('lets an owner into /owner only', async () => {
      const client = await loggedIn(owner.email, owner.password);
      assert.equal((await client.request('GET', '/api/owner')).status, 200);
      assert.equal((await client.request('GET', '/api/boarder')).status, 403);
      assert.equal((await client.request('GET', '/api/admin')).status, 403);
    });

    it('lets an admin into /admin only', async () => {
      const client = await loggedIn(admin.email, admin.password);
      assert.equal((await client.request('GET', '/api/admin')).status, 200);
      assert.equal((await client.request('GET', '/api/owner')).status, 403);
      assert.equal((await client.request('GET', '/api/boarder')).status, 403);
    });
  });

  describe('security activity', () => {
    async function loggedInAdmin() {
      const client = newClient();
      const response = await client.request('POST', '/api/auth/login', {
        email: admin.email,
        password: admin.password,
      });
      assert.equal(response.status, 200);
      return client;
    }

    it('records success, failure, and logout events without logging credentials', async () => {
      const client = newClient();
      await client.request('POST', '/api/auth/login', { email: owner.email, password: owner.password });
      const session = await prisma.session.findFirst({
        where: { user: { email: owner.email } },
        orderBy: { createdAt: 'desc' },
      });
      assert.equal(session?.userAgent, 'StayFinder Test Browser');
      assert.ok(session?.ipAddress);

      await client.request('POST', '/api/auth/logout');
      await newClient().request('POST', '/api/auth/login', {
        email: 'security-failed@example.com',
        password: 'NeverExport123',
      });
      const events = await prisma.securityEvent.findMany({
        where: { email: { in: [owner.email, 'security-failed@example.com'] } },
      });
      assert.ok(events.some((event) => event.action === 'LOGIN_SUCCESS' && event.email === owner.email));
      assert.ok(events.some((event) => event.action === 'LOGOUT' && event.email === owner.email));
      assert.ok(events.some((event) => event.action === 'LOGIN_FAILED' && event.email === 'security-failed@example.com'));
      assert.ok(events.every((event) => !JSON.stringify(event).includes('NeverExport123')));
    });

    it('protects security data, filters/searches logs, exports safe CSV, and revokes sessions', async () => {
      const ownerClient = newClient();
      await ownerClient.request('POST', '/api/auth/login', { email: owner.email, password: owner.password });
      assert.equal((await ownerClient.request('GET', '/api/admin/security')).status, 403);

      const adminClient = await loggedInAdmin();
      const filtered = await adminClient.request(
        'GET',
        '/api/admin/security?q=security-failed@example.com&status=FAILED&action=LOGIN_FAILED',
      );
      assert.equal(filtered.status, 200);
      assert.equal(filtered.data?.auditLogs.length, 1);
      assert.equal(filtered.data?.auditLogs[0].email, 'security-failed@example.com');
      assert.equal(filtered.data?.loginActivity[0].loginStatus, 'FAILED');
      assert.ok(!JSON.stringify(filtered.data).includes('passwordHash'));
      assert.ok(!JSON.stringify(filtered.data).includes('NeverExport123'));

      const adminLoginEvent = await prisma.securityEvent.findFirstOrThrow({
        where: { email: admin.email, action: 'LOGIN_SUCCESS' },
        orderBy: { createdAt: 'desc' },
      });
      const date = adminLoginEvent.createdAt.toISOString().slice(0, 10);
      const compoundFilters = new URLSearchParams({
        from: date,
        to: date,
        user: admin.email,
        role: 'ADMIN',
        action: 'LOGIN_SUCCESS',
        status: 'SUCCESS',
        ip: adminLoginEvent.ipAddress ?? '',
      });
      const byAllFilters = await adminClient.request('GET', `/api/admin/security?${compoundFilters}`);
      assert.equal(byAllFilters.status, 200);
      assert.ok(byAllFilters.data?.auditLogs.length >= 1);
      assert.ok(byAllFilters.data?.auditLogs.every((event: { email: string; role: string }) =>
        event.email === admin.email && event.role === 'ADMIN'));

      const exported = await adminClient.request(
        'GET',
        `/api/admin/security/export.csv?q=${encodeURIComponent(owner.email)}`,
      );
      assert.equal(exported.status, 200);
      assert.match(exported.data as string, /Email/);
      assert.match(exported.data as string, /owner@example\.com/);
      assert.ok(!(exported.data as string).includes(owner.password));
      assert.ok(!(exported.data as string).includes('tokenHash'));

      const boarderClient = newClient();
      await boarderClient.request('POST', '/api/auth/login', { email: boarder.email, password: boarder.password });
      const boarderSession = await prisma.session.findFirst({
        where: { user: { email: boarder.email } },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(boarderSession);
      const revoked = await adminClient.request('DELETE', `/api/admin/security/sessions/${boarderSession!.id}`);
      assert.equal(revoked.status, 200);
      assert.equal((await boarderClient.request('GET', '/api/auth/me')).status, 401);
      assert.ok(await prisma.securityEvent.findFirst({
        where: { action: 'SESSION_REVOKED', target: { contains: boarder.email } },
      }));
    });
  });

  describe('OAuth configuration', () => {
    it('reports providers as unavailable until credentials are configured', async () => {
      const client = newClient();
      const { oauthConfig } = await import('../src/config/env');
      const google = { ...oauthConfig.google };
      const facebook = { ...oauthConfig.facebook };
      try {
        Object.assign(oauthConfig.google, { clientId: undefined, clientSecret: undefined, callbackUrl: undefined });
        Object.assign(oauthConfig.facebook, { clientId: undefined, clientSecret: undefined, callbackUrl: undefined });
        const providers = await client.request('GET', '/api/auth/oauth/providers');
        assert.equal(providers.status, 200);
        assert.equal(providers.data?.providers.google.enabled, false);
        assert.equal(providers.data?.providers.facebook.enabled, false);
        assert.equal((await client.request('GET', '/api/auth/oauth/google')).status, 503);
        assert.equal((await client.request('GET', '/api/auth/oauth/facebook')).status, 503);
        assert.equal((await client.request('GET', '/api/auth/oauth/twitter')).status, 404);
      } finally {
        Object.assign(oauthConfig.google, google);
        Object.assign(oauthConfig.facebook, facebook);
      }
    });
  });
});