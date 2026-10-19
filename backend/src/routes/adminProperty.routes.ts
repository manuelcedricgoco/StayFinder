import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { listPropertiesForAdmin, setPropertyStatus } from '../services/property.service';
import { actorSecurityEvent } from '../services/security.service';
import {
  adminStatusSchema,
  parseStatusFilter,
  type AdminStatusInput,
} from '../validators/property.validators';

// Mounted at /api/admin/properties - ADMIN accounts only.
// The admin dashboard uses these endpoints for listing review.
export const adminPropertyRouter = Router();
adminPropertyRouter.use(requireAuth, requireRole('ADMIN'));

// GET /api/admin/properties?status=PENDING - the review queue
adminPropertyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const properties = await listPropertiesForAdmin(parseStatusFilter(req.query.status));
    res.json({ status: 'ok', properties });
  }),
);

// PATCH /api/admin/properties/:id/status  { status: "APPROVED" | "REJECTED" | "INACTIVE", rejectionReason? }
adminPropertyRouter.patch(
  '/:id/status',
  validateBody(adminStatusSchema),
  asyncHandler(async (req, res) => {
    const { status, rejectionReason } = req.body as AdminStatusInput;
    const property = await setPropertyStatus(req.params.id, status, rejectionReason);
    const action = status === 'APPROVED' ? 'LISTING_APPROVED'
      : status === 'REJECTED' ? 'LISTING_REJECTED'
        : 'LISTING_MODIFIED';
    await actorSecurityEvent(req, action, `Listing ${property.name}: ${status}`);
    res.json({ status: 'ok', property });
  }),
);
