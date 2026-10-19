import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

export const SESSION_COOKIE_NAME = 'stayfinder_session';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function baseOptions(): CookieOptions {
  return {
    httpOnly: true, // JavaScript in the browser cannot read it (protects against XSS theft)
    sameSite: 'lax', // not sent on cross-site POSTs (protects against CSRF)
    secure: env.isProduction, // HTTPS only in production
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseOptions(), expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseOptions());
}

// Minimal cookie reader, so we don't need the cookie-parser package.
export function readSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;

    const value = part.slice(separator + 1).trim();
    return TOKEN_PATTERN.test(value) ? value : undefined;
  }
  return undefined;
}
