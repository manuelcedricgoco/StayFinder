import { Router } from 'express';
import { adminPropertyRouter } from './adminProperty.routes';
import { adminRouter } from './admin.routes';
import { areaRouter } from './area.routes';
import { authRouter } from './auth.routes';
import { boarderRouter } from './boarder.routes';
import { healthRouter } from './health.routes';
import { ownerPropertyRouter } from './ownerProperty.routes';
import { ownerRouter } from './owner.routes';
import { publicPropertyRouter } from './publicProperty.routes';
import { referenceRouter } from './reference.routes';
import { settingsRouter } from './settings.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use(referenceRouter); // /api/locations, /api/amenities
apiRouter.use('/properties', publicPropertyRouter);
apiRouter.use('/owner/properties', ownerPropertyRouter);
apiRouter.use('/owner', ownerRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/admin/properties', adminPropertyRouter);
apiRouter.use('/boarder', boarderRouter);
apiRouter.use(areaRouter); // /api/admin, /api/owner, /api/boarder

// Future phases mount their routers here.
