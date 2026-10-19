import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

// Validates req.body and replaces it with the cleaned data (trimmed, lowercased, unknown keys removed).
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        status: 'error',
        message: 'Please fix the highlighted fields.',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
