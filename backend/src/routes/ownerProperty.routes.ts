import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { asyncHandler } from '../lib/asyncHandler';
import { MAX_PROPERTY_IMAGE_SIZE, MAX_PROPERTY_IMAGES } from '../lib/propertyImageStorage';
import { HttpError } from '../lib/HttpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createProperty,
  addPropertyImages,
  deleteProperty,
  getOwnerProperty,
  listOwnerProperties,
  removePropertyImage,
  setPropertyCoverImage,
  updateProperty,
} from '../services/property.service';
import { parseStatusFilter, propertySchema, type PropertyInput } from '../validators/property.validators';

// Mounted at /api/owner/properties - OWNER accounts only.
export const ownerPropertyRouter = Router();
ownerPropertyRouter.use(requireAuth, requireRole('OWNER'));

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROPERTY_IMAGE_SIZE, files: MAX_PROPERTY_IMAGES, fields: 0 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) callback(null, true);
    else callback(new HttpError(400, 'Please upload JPG, PNG, or WebP images.'));
  },
});

const parseImageUpload: RequestHandler = (req, res, next) => {
  imageUpload.array('images', MAX_PROPERTY_IMAGES)(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    };
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 5 MB or smaller.'
        : error.code === 'LIMIT_FILE_COUNT'
          ? `A property can have up to ${MAX_PROPERTY_IMAGES} images.`
          : 'Could not process the property image upload.';
      next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message));
      return;
    }
    next(error);
  });
}

// GET /api/owner/properties?status=PENDING   (status is optional)
ownerPropertyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const properties = await listOwnerProperties(req.user!.id, parseStatusFilter(req.query.status));
    res.json({ status: 'ok', properties });
  }),
);

// POST /api/owner/properties - always created as PENDING
ownerPropertyRouter.post(
  '/',
  validateBody(propertySchema),
  asyncHandler(async (req, res) => {
    const property = await createProperty(req.user!.id, req.body as PropertyInput);
    res.status(201).json({ status: 'ok', property });
  }),
);

ownerPropertyRouter.post(
  '/:id/images',
  parseImageUpload,
  asyncHandler(async (req, res) => {
    const property = await addPropertyImages(req.user!.id, req.params.id, (req.files ?? []) as Express.Multer.File[]);
    res.status(201).json({ status: 'ok', property });
  }),
);

ownerPropertyRouter.patch(
  '/:id/images/:imageId/cover',
  asyncHandler(async (req, res) => {
    const property = await setPropertyCoverImage(req.user!.id, req.params.id, req.params.imageId);
    res.json({ status: 'ok', property });
  }),
);

ownerPropertyRouter.delete(
  '/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    const property = await removePropertyImage(req.user!.id, req.params.id, req.params.imageId);
    res.json({ status: 'ok', property });
  }),
);

ownerPropertyRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const property = await getOwnerProperty(req.user!.id, req.params.id);
    res.json({ status: 'ok', property });
  }),
);

ownerPropertyRouter.put(
  '/:id',
  validateBody(propertySchema),
  asyncHandler(async (req, res) => {
    const property = await updateProperty(req.user!.id, req.params.id, req.body as PropertyInput);
    res.json({ status: 'ok', property });
  }),
);

ownerPropertyRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteProperty(req.user!.id, req.params.id);
    res.json({ status: 'ok' });
  }),
);
