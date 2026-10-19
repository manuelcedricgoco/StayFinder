import { rateLimit } from 'express-rate-limit';
import type { RateLimitRequestHandler } from 'express-rate-limit';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// Keyed by client IP (req.ip). Uses IETF RateLimit-* headers instead of
// the legacy X-RateLimit-* ones so clients can see when they are throttled,
// and answers with the same { status: 'error', message } shape as the API.
function buildLimiter(limit: number, message: string): RateLimitRequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ status: 'error', message });
    },
    // The integration test suite shares one IP, so limiters are disabled while
    // NODE_ENV is "test"; tests/rateLimit.test.ts enables them temporarily.
    skip: () => process.env.NODE_ENV === 'test',
  });
}

// 10 POST /api/auth/login|register requests per 15 minutes per IP.
export const authLimiter = buildLimiter(10, 'Too many requests, please try again later.');

// 30 /api/auth/oauth/* requests per 15 minutes per IP.
export const oauthLimiter = buildLimiter(30, 'Too many requests, please try again later.');

// 300 requests per 15 minutes per IP for the whole API.
export const apiLimiter = buildLimiter(300, 'Too many requests, please try again later.');
