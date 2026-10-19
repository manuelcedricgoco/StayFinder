import type { Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { readSessionToken } from '../lib/sessionCookie';
import { findUserBySessionToken } from '../services/session.service';

// 1) Authentication: "who are you?" - requires a valid session cookie.
export const requireAuth: RequestHandler = asyncHandler(async (req, res, next) => {
  const token = readSessionToken(req);
  const user = token ? await findUserBySessionToken(token) : null;

  if (!user) {
    res.status(401).json({ status: 'error', message: 'Please log in to continue.' });
    return;
  }
  req.user = user;
  next();
});

// 2) Authorization: "are you allowed?" - use AFTER requireAuth.
export function requireRole(...allowedRoles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Please log in to continue.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        message: 'You do not have permission to access this area.',
      });
      return;
    }
    next();
  };
}
