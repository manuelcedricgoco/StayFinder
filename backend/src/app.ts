import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { AVATAR_DIRECTORY } from './lib/avatarStorage';
import { PROPERTY_IMAGE_DIRECTORY } from './lib/propertyImageStorage';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // credentials: true lets the browser send the session cookie.
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/uploads/avatars', express.static(AVATAR_DIRECTORY, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
    immutable: true,
  }));
  app.use('/api/uploads/properties', express.static(PROPERTY_IMAGE_DIRECTORY, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
    immutable: true,
  }));

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
