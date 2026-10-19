import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { AVATAR_DIRECTORY } from './lib/avatarStorage';
import { PROPERTY_IMAGE_DIRECTORY } from './lib/propertyImageStorage';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  // Behind a reverse proxy, read the client IP from X-Forwarded-For as far as
  // the configured proxies are trusted; req.ip then drives rate limiting.
  app.set('trust proxy', env.trustProxy ?? false);
  app.disable('x-powered-by');
  // Lock the API down with security headers. The strict CSP fits responses
  // that are only ever JSON; CORP is relaxed so the frontend can display
  // images served from /api/uploads.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  // credentials: true lets the browser send the session cookie.
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/uploads/avatars', express.static(AVATAR_DIRECTORY, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
  app.use('/api/uploads/properties', express.static(PROPERTY_IMAGE_DIRECTORY, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
