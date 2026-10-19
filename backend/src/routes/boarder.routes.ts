import { Router } from 'express';
import multer from 'multer';
import type { ZodType } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { HttpError } from '../lib/HttpError';
import { MAX_AVATAR_SIZE } from '../lib/avatarStorage';
import { readSessionToken } from '../lib/sessionCookie';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  addBoarderFavorite,
  changeBoarderPassword,
  createBoarderInquiry,
  createBoarderReport,
  createBoarderReview,
  getBoarderSettings,
  listBoarderFavorites,
  listBoarderInquiries,
  listBoarderReports,
  listBoarderReviews,
  removeBoarderFavorite,
  removeBoarderAvatar,
  updateBoarderAvatar,
  updateBoarderPreferences,
  updateBoarderProfile,
} from '../services/boarder.service';
import { actorSecurityEvent, requestSecurityContext } from '../services/security.service';
import { revokeOtherUserSessions } from '../services/session.service';
import {
  boarderPasswordChangeSchema,
  boarderPreferencesSchema,
  boarderProfileSchema,
  inquirySchema,
  reportSchema,
  reviewSchema,
} from '../validators/boarder.validators';

export const boarderRouter = Router();
boarderRouter.use(requireAuth, requireRole('BOARDER'));

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) callback(null, true);
    else callback(new HttpError(400, 'Upload a JPEG, PNG, or WebP image.'));
  },
});

const parseAvatarUpload: import('express').RequestHandler = (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'Could not process the profile image upload.'));
      return;
    }
    next(error);
  });
};

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'Please check the submitted fields.', parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })));
  }
  return parsed.data;
}

boarderRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    if (!token) throw new HttpError(401, 'Please log in to continue.');
    const settings = await getBoarderSettings(req.user!.id, token);
    res.json({ status: 'ok', settings });
  }),
);

boarderRouter.put(
  '/settings/preferences',
  asyncHandler(async (req, res) => {
    const preferences = await updateBoarderPreferences(
      req.user!.id,
      parseBody(boarderPreferencesSchema, req.body),
    );
    await actorSecurityEvent(req, 'BOARDER_PREFERENCES_CHANGED', 'Boarder search and notification preferences');
    res.json({ status: 'ok', preferences });
  }),
);

boarderRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const user = await updateBoarderProfile(req.user!.id, parseBody(boarderProfileSchema, req.body));
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Boarder profile');
    res.json({ status: 'ok', user });
  }),
);

boarderRouter.post(
  '/profile/avatar',
  parseAvatarUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a profile image to upload.');
    const user = await updateBoarderAvatar(req.user!.id, {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Boarder profile avatar');
    res.json({ status: 'ok', user });
  }),
);

boarderRouter.delete(
  '/profile/avatar',
  asyncHandler(async (req, res) => {
    const user = await removeBoarderAvatar(req.user!.id);
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Boarder profile avatar');
    res.json({ status: 'ok', user });
  }),
);

boarderRouter.post(
  '/password',
  asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    if (!token) throw new HttpError(401, 'Please log in to continue.');
    await changeBoarderPassword(
      req.user!.id,
      parseBody(boarderPasswordChangeSchema, req.body),
      token,
      requestSecurityContext(req),
    );
    res.json({ status: 'ok' });
  }),
);

boarderRouter.post(
  '/sessions/revoke-others',
  asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    if (!token) throw new HttpError(401, 'Please log in to continue.');
    const revokedCount = await revokeOtherUserSessions(
      req.user!.id,
      token,
      { name: req.user!.name, email: req.user!.email, role: req.user!.role },
      requestSecurityContext(req),
    );
    res.json({ status: 'ok', revokedCount });
  }),
);

boarderRouter.get(
  '/favorites',
  asyncHandler(async (req, res) => {
    const favorites = await listBoarderFavorites(req.user!.id);
    res.json({ status: 'ok', favorites });
  }),
);

boarderRouter.post(
  '/favorites/:propertyId',
  asyncHandler(async (req, res) => {
    const favorite = await addBoarderFavorite(req.user!.id, req.params.propertyId);
    res.status(201).json({ status: 'ok', favorite });
  }),
);

boarderRouter.delete(
  '/favorites/:propertyId',
  asyncHandler(async (req, res) => {
    await removeBoarderFavorite(req.user!.id, req.params.propertyId);
    res.json({ status: 'ok' });
  }),
);

boarderRouter.get(
  '/inquiries',
  asyncHandler(async (req, res) => {
    const inquiries = await listBoarderInquiries(req.user!.id);
    res.json({ status: 'ok', inquiries });
  }),
);

boarderRouter.post(
  '/inquiries',
  asyncHandler(async (req, res) => {
    const parsed = inquirySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the inquiry details.', parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })));
    }
    const inquiry = await createBoarderInquiry(req.user!.id, parsed.data);
    res.status(201).json({ status: 'ok', inquiry });
  }),
);

boarderRouter.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await listBoarderReviews(req.user!.id);
    res.json({ status: 'ok', reviews });
  }),
);

boarderRouter.post(
  '/properties/:propertyId/reviews',
  asyncHandler(async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the review details.', parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })));
    }
    const review = await createBoarderReview(req.user!.id, req.params.propertyId, parsed.data);
    res.status(201).json({ status: 'ok', review });
  }),
);

boarderRouter.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const reports = await listBoarderReports(req.user!.id);
    res.json({ status: 'ok', reports });
  }),
);

boarderRouter.post(
  '/properties/:propertyId/reports',
  asyncHandler(async (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the report details.', parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })));
    }
    const report = await createBoarderReport(req.user!.id, req.params.propertyId, parsed.data);
    res.status(201).json({ status: 'ok', report });
  }),
);
