import type { PublicUser } from '../lib/publicUser';

// Lets TypeScript know that requireAuth attaches `req.user`.
declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};
