import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { getPublicProperty, searchPublicProperties } from '../services/property.service';
import { publicPropertySearchSchema } from '../validators/property.validators';

export const publicPropertyRouter = Router();

publicPropertyRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const property = await getPublicProperty(req.params.id);
    res.json({ status: 'ok', property });
  }),
);

publicPropertyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = publicPropertySearchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid property search filters.',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const result = await searchPublicProperties(parsed.data);
    res.json({ status: 'ok', ...result });
  }),
);
