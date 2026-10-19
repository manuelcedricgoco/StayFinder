// Integration tests for brute-force protection and the IP rate limiters.
// Run with: npm test
// The other suites share one IP and run with limiters disabled (NODE_ENV=test),
// so this file temporarily enables them around each request. Requests are
// counted from the same IP across tests, which the assertions rely on.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { TestClient } from './helpers/testClient';

const TEST_DATABASE_URL = 'file:./test-ratelimit.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

describe('Brute-force protection and rate limiting', () => {
  let server: Server;
  let baseUrl = '';
  let prisma: typeof import('../src/lib/prisma').prisma;
  let hashPassword: typeof import('../src/lib/password').hashPassword;

  const RATE_LIMITED_MESSAGE = 'Too many requests, please try again later.';
  const ACCOUNT_LOCKED_MESSAGE = 'Too many failed login attempts. Please try again later.';

  // Limiters skip requests while NODE_ENV is "test", so flip it just around each call.
  async function withLimiters(request: () => Promise<{ status: number; data: Record<string, any> | null }>) {
    process.env.NODE_ENV = 'development';
    try {
      return await request();
    } finally {
      process.env.NODE_ENV = 'test';
    }
  }

  before(async () => {
    const backendDir = path.resolve(__dirname, '..');
    const testDbFile = path.join(backendDir, 'prisma', 'test-ratelimit.db');
    for (const file of [testDbFile, `${testDbFile}-journal`]) fs.rmSync(file, { force: true });

    execSync('npx prisma db push --skip-generate', {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
    assert.ok(fs.existsSync(testDbFile), 'Test database was not created - aborting.');

    ({ prisma } = await import('../src/lib/prisma'));
    ({ hashPassword } = await import('../src/lib/password'));
    const { createApp } = await import('../src/app');

    server = createApp().listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    // Accounts are created directly so setup does not spend auth-limiter budget.
    for (const email of ['owner@example.com', 'bruteforce@example.com']) {
      await prisma.user.create({
        data: { name: email, email, role: 'OWNER', passwordHash: await hashPassword('Passw0rd123') },
      });
    }
  });

  after(async () => {
    server?.close();
    await prisma?.$disconnect();
  });

  describe('per-account login protection', () => {
    it('locks out an email with a generic 429 after 5 failed attempts in 15 minutes', async () => {
      const email = 'bruteforce@example.com';
      const client = new TestClient(baseUrl);

      for (let attempt = 0; attempt < 5; attempt++) {
        const failed = await withLimiters(() =>
          client.request('POST', '/api/auth/login', { email, password: 'WrongPass999' }),
        );
        assert.equal(failed.status, 401, `attempt ${attempt + 1}`);
      }
      assert.equal(
        await prisma.securityEvent.count({ where: { action: 'LOGIN_FAILED', email } }),
        5,
      );

      // Even the correct password is refused once the account is throttled.
      const blocked = await withLimiters(() =>
        client.request('POST', '/api/auth/login', { email, password: 'Passw0rd123' }),
      );
      assert.equal(blocked.status, 429);
      assert.equal(blocked.data?.status, 'error');
      assert.equal(blocked.data?.message, ACCOUNT_LOCKED_MESSAGE);
      assert.deepEqual(Object.keys(blocked.data as object).sort(), ['message', 'status']);

      // The run before any scrypt verify happened: the blocked attempt recorded nothing.
      assert.equal(
        await prisma.securityEvent.count({ where: { action: 'LOGIN_FAILED', email } }),
        5,
      );
    });

    it('does not lock other accounts while one email is throttled', async () => {
      const client = new TestClient(baseUrl);
      const unaffected = await withLimiters(() =>
        client.request('POST', '/api/auth/login', {
          email: 'owner@example.com',
          password: 'Passw0rd123',
        }),
      );
      assert.equal(unaffected.status, 200);
      assert.equal(unaffected.data?.user.email, 'owner@example.com');
    });

    it('lets the account log in again after the failures left the window', async () => {
      await prisma.securityEvent.deleteMany({ where: { email: 'bruteforce@example.com' } });
      const client = new TestClient(baseUrl);
      const recovered = await withLimiters(() =>
        client.request('POST', '/api/auth/login', {
          email: 'bruteforce@example.com',
          password: 'Passw0rd123',
        }),
      );
      assert.equal(recovered.status, 200);
    });
  });

  describe('IP rate limiters', () => {
    it('answers with the API error shape from the 11th auth request per IP', async () => {
      const client = new TestClient(baseUrl);

      // Requests 9 and 10 still work (each email is new, so accounts never trip first).
      for (let round = 0; round < 2; round++) {
        const res = await withLimiters(() =>
          client.request('POST', '/api/auth/login', {
            email: `unknown-${round}@example.com`,
            password: 'Passw0rd123',
          }),
        );
        assert.equal(res.status, 401, `request ${round + 1}`);
      }

      const limited = await withLimiters(() =>
        client.request('POST', '/api/auth/login', {
          email: 'the-eleventh@example.com',
          password: 'Passw0rd123',
        }),
      );
      assert.equal(limited.status, 429);
      assert.equal(limited.data?.status, 'error');
      assert.equal(limited.data?.message, RATE_LIMITED_MESSAGE);
      assert.deepEqual(Object.keys(limited.data as object).sort(), ['message', 'status']);

      // Valid credentials from the same IP are refused too while the window runs.
      const validEmail = await withLimiters(() =>
        client.request('POST', '/api/auth/login', {
          email: 'owner@example.com',
          password: 'Passw0rd123',
        }),
      );
      assert.equal(validEmail.status, 429);
    });

    it('limits /api/auth/oauth/* to 30 requests per IP in 15 minutes', async () => {
      const client = new TestClient(baseUrl);

      for (let round = 0; round < 30; round++) {
        const res = await withLimiters(() => client.request('GET', '/api/auth/oauth/providers'));
        assert.equal(res.status, 200, `request ${round + 1}`);
      }

      const limited = await withLimiters(() => client.request('GET', '/api/auth/oauth/providers'));
      assert.equal(limited.status, 429);
      assert.equal(limited.data?.status, 'error');
      assert.equal(limited.data?.message, RATE_LIMITED_MESSAGE);
    });
  });
});
