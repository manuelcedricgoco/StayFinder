import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { prisma } from '../lib/prisma';

// Public reference data used by the property form (and, later, by search filters).
export const referenceRouter = Router();

referenceRouter.get(
  '/locations',
  asyncHandler(async (_req, res) => {
    const locations = await prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'ok', locations });
  }),
);

referenceRouter.get(
  '/amenities',
  asyncHandler(async (_req, res) => {
    const amenities = await prisma.amenity.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ status: 'ok', amenities });
  }),
);
