import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { getPublicPlatformSettings } from '../services/platformSettings.service';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getPublicPlatformSettings();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', settings });
  }),
);
