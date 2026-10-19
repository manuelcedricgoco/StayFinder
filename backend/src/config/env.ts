import dotenv from 'dotenv';

// Load variables from backend/.env into process.env
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        'Copy backend/.env.example to backend/.env and try again.',
    );
  }
  return value;
}

// Empty strings in .env count as "not set".
function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function positiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Accepts "true" (trust all proxies), a hop count, or comma-separated proxied addresses.
function trustProxyEnv(name: string): boolean | number | string | undefined {
  const value = optionalEnv(name);
  if (value === undefined) return undefined;
  if (value.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // Prisma reads DATABASE_URL by itself; we check it here to fail early with a clear message.
  databaseUrl: requireEnv('DATABASE_URL'),
  sessionTtlDays: positiveNumber('SESSION_TTL_DAYS', 7),
  // A session is dropped after this many hours without any request.
  sessionIdleHours: positiveNumber('SESSION_IDLE_HOURS', 24),
  // undefined keeps Express's default (proxy headers like X-Forwarded-For are ignored).
  trustProxy: trustProxyEnv('TRUST_PROXY'),
};

// Fail fast on unsafe production settings.
if (env.isProduction) {
  if (!env.frontendUrl.startsWith('https://')) {
    throw new Error(
      'FRONTEND_URL must start with "https://" when NODE_ENV is "production".',
    );
  }
  if (process.env.ADMIN_PASSWORD === 'Admin12345') {
    throw new Error(
      'ADMIN_PASSWORD is still the known default "Admin12345" - set a strong, unique password before running in production.',
    );
  }
}

// Optional OAuth credentials. Providers remain unavailable until all provider settings are valid.
export const oauthConfig = {
  google: {
    clientId: optionalEnv('GOOGLE_CLIENT_ID'),
    clientSecret: optionalEnv('GOOGLE_CLIENT_SECRET'),
    callbackUrl: optionalEnv('GOOGLE_CALLBACK_URL'),
  },
  facebook: {
    clientId: optionalEnv('FACEBOOK_APP_ID'),
    clientSecret: optionalEnv('FACEBOOK_APP_SECRET'),
    callbackUrl: optionalEnv('FACEBOOK_CALLBACK_URL'),
    graphApiVersion: optionalEnv('FACEBOOK_GRAPH_API_VERSION') ?? 'v22.0',
  },
};
