import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';

// Placeholder endpoints that prove role-based protection works.
// Each area is strict: only its own role may enter. Real dashboards come in later phases.
export const areaRouter = Router();

areaRouter.get('/owner', requireAuth, requireRole('OWNER'), (_req, res) => {
  res.json({ status: 'ok', area: 'owner', message: 'Owner area placeholder.' });
});

areaRouter.get('/boarder', requireAuth, requireRole('BOARDER'), (_req, res) => {
  res.json({ status: 'ok', area: 'boarder', message: 'Boarder area placeholder.' });
});
