import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../lib/HttpError';

// Catches errors thrown in routes. Details are logged on the server only,
// so stack traces and internals are never sent to the client.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Expected, intentional errors (not found, bad reference data, ...)
  if (err instanceof HttpError) {
    res.status(err.status).json({
      status: 'error',
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
    return;
  }

  const type = (err as { type?: string } | null)?.type;

  // Problems with the request body (raised by express.json) are the client's fault.
  if (type === 'entity.parse.failed') {
    res.status(400).json({ status: 'error', message: 'Request body is not valid JSON.' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ status: 'error', message: 'Request body is too large.' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server.',
  });
};
