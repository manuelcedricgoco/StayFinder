import { Router } from 'express';
import multer from 'multer';
import type { ZodType } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { MAX_AVATAR_SIZE } from '../lib/avatarStorage';
import { HttpError } from '../lib/HttpError';
import { readSessionToken } from '../lib/sessionCookie';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  changeOwnerPassword,
  createOwnerPaymentRecord,
  createOwnerRoom,
  deleteOwnerRoom,
  exportOwnerPaymentRecords,
  getOwnerPaymentRecord,
  getOwnerDashboardStats,
  getOwnerSettings,
  getOwnerVerification,
  listOwnerPaymentRecords,
  listOwnerInquiries,
  listOwnerReviews,
  listOwnerRooms,
  respondToOwnerInquiry,
  submitOwnerVerification,
  updateOwnerProfile,
  updateOwnerRoom,
  removeOwnerAvatar,
  updateOwnerAvatar,
  updateOwnerPreferences,
} from '../services/owner.service';
import type { OwnerInquiryQuery, OwnerPaymentMethod, OwnerPaymentQuery, OwnerReviewQuery } from '../services/owner.service';
import {
  ownerInquiryReplySchema,
  ownerPasswordChangeSchema,
  ownerProfileSchema,
  ownerPreferencesSchema,
  ownerVerificationSchema,
  roomSchema,
} from '../validators/owner.validators';
import { paymentRecordSchema, type PaymentRecordInput } from '../validators/payment.validators';
import { actorSecurityEvent, requestSecurityContext } from '../services/security.service';
import { revokeOtherUserSessions } from '../services/session.service';

export const ownerRouter = Router();
ownerRouter.use(requireAuth, requireRole('OWNER'));

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

function parseOwnerReviewQuery(query: Record<string, unknown>): OwnerReviewQuery {
  const read = (key: string) => {
    const value = query[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new HttpError(400, `Invalid ${key} filter.`);
    return value.trim();
  };
  const pageValue = read('page') ?? '1';
  const page = Number(pageValue);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    throw new HttpError(400, 'Page must be a positive integer.');
  }
  const propertyId = read('propertyId');
  const ratingValue = read('rating');
  const rating = ratingValue === undefined || ratingValue === '' ? undefined : Number(ratingValue);
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new HttpError(400, 'Rating must be between 1 and 5.');
  }

  const statusValue = read('status');
  if (statusValue && !['PENDING', 'APPROVED', 'REJECTED'].includes(statusValue)) {
    throw new HttpError(400, 'Status must be PENDING, APPROVED, or REJECTED.');
  }
  const sortValue = read('sort') ?? 'NEWEST';
  if (!['NEWEST', 'OLDEST', 'HIGHEST_RATING', 'LOWEST_RATING'].includes(sortValue)) {
    throw new HttpError(400, 'Choose a valid review sort order.');
  }
  const search = read('search');
  if (search && search.length > 100) throw new HttpError(400, 'Search must be 100 characters or fewer.');
  if (propertyId && propertyId.length > 100) throw new HttpError(400, 'Property filter is invalid.');

  return {
    page,
    ...(propertyId ? { propertyId } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(statusValue ? { status: statusValue as OwnerReviewQuery['status'] } : {}),
    ...(search ? { search } : {}),
    sort: sortValue as OwnerReviewQuery['sort'],
  };
}

function parseOwnerInquiryQuery(query: Record<string, unknown>): OwnerInquiryQuery {
  const read = (key: string) => {
    const value = query[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new HttpError(400, `Invalid ${key} filter.`);
    return value.trim();
  };
  const pageValue = read('page') ?? '1';
  const page = Number(pageValue);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    throw new HttpError(400, 'Page must be a positive integer.');
  }
  const propertyId = read('propertyId');
  const statusValue = read('status');
  if (statusValue && !['PENDING', 'RESPONDED', 'CLOSED'].includes(statusValue)) {
    throw new HttpError(400, 'Status must be PENDING, RESPONDED, or CLOSED.');
  }
  const sortValue = read('sort') ?? 'NEWEST';
  if (!['NEWEST', 'OLDEST', 'UPDATED'].includes(sortValue)) {
    throw new HttpError(400, 'Choose a valid inquiry sort order.');
  }
  const search = read('search');
  if (search && search.length > 100) throw new HttpError(400, 'Search must be 100 characters or fewer.');
  if (propertyId && propertyId.length > 100) throw new HttpError(400, 'Property filter is invalid.');

  return {
    page,
    ...(propertyId ? { propertyId } : {}),
    ...(statusValue ? { status: statusValue as OwnerInquiryQuery['status'] } : {}),
    ...(search ? { search } : {}),
    sort: sortValue as OwnerInquiryQuery['sort'],
  };
}

function parseOwnerPaymentQuery(query: Record<string, unknown>): OwnerPaymentQuery {
  const read = (key: string) => {
    const value = query[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new HttpError(400, `Invalid ${key} filter.`);
    return value.trim();
  };
  const pageValue = read('page') ?? '1';
  const page = Number(pageValue);
  if (!Number.isInteger(page) || page < 1 || page > 100_000) {
    throw new HttpError(400, 'Page must be a positive integer.');
  }
  const propertyId = read('propertyId');
  const paymentMethodValue = read('paymentMethod');
  if (paymentMethodValue && !['CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'OTHER'].includes(paymentMethodValue)) {
    throw new HttpError(400, 'Choose a valid recorded payment method.');
  }
  const search = read('search');
  const fromValue = read('from');
  const toValue = read('to');
  const parseDate = (value: string | undefined, field: string) => {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `${field} must use YYYY-MM-DD format.`);
    const date = new Date(`${value}T${field === 'to' ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new HttpError(400, `${field} is not a valid date.`);
    }
    return date;
  };
  const from = parseDate(fromValue, 'from');
  const to = parseDate(toValue, 'to');
  if (from && to && from > to) throw new HttpError(400, 'Start date must not be after end date.');
  if (search && search.length > 100) throw new HttpError(400, 'Search must be 100 characters or fewer.');
  if (propertyId && propertyId.length > 100) throw new HttpError(400, 'Property filter is invalid.');

  return {
    page,
    ...(propertyId ? { propertyId } : {}),
    ...(paymentMethodValue ? { paymentMethod: paymentMethodValue as OwnerPaymentMethod } : {}),
    ...(search ? { search } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

ownerRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const stats = await getOwnerDashboardStats(req.user!.id);
    res.json({ status: 'ok', stats });
  }),
);

ownerRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    if (!token) throw new HttpError(401, 'Please log in to continue.');
    const settings = await getOwnerSettings(req.user!.id, token);
    res.json({ status: 'ok', settings });
  }),
);

ownerRouter.put(
  '/settings/preferences',
  asyncHandler(async (req, res) => {
    const preferences = await updateOwnerPreferences(
      req.user!.id,
      parseBody(ownerPreferencesSchema, req.body),
    );
    await actorSecurityEvent(req, 'OWNER_PREFERENCES_CHANGED', 'Owner preferences');
    res.json({ status: 'ok', preferences });
  }),
);

ownerRouter.post(
  '/password',
  asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    if (!token) throw new HttpError(401, 'Please log in to continue.');
    await changeOwnerPassword(
      req.user!.id,
      parseBody(ownerPasswordChangeSchema, req.body),
      token,
      requestSecurityContext(req),
    );
    res.json({ status: 'ok' });
  }),
);

ownerRouter.post(
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

ownerRouter.get(
  '/payments/export.csv',
  asyncHandler(async (req, res) => {
    const query = parseOwnerPaymentQuery({ ...req.query, page: '1' });
    const csv = await exportOwnerPaymentRecords(req.user!.id, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="stayfinder-payment-records.csv"');
    res.send(`\uFEFF${csv}`);
  }),
);

ownerRouter.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const payments = await listOwnerPaymentRecords(req.user!.id, parseOwnerPaymentQuery(req.query));
    res.json({ status: 'ok', ...payments });
  }),
);

ownerRouter.post(
  '/payments',
  asyncHandler(async (req, res) => {
    const input = parseBody<PaymentRecordInput>(paymentRecordSchema, req.body);
    const context = requestSecurityContext(req);
    const record = await createOwnerPaymentRecord(req.user!.id, input, {
      userId: req.user!.id,
      userName: req.user!.name,
      email: req.user!.email,
      ...context,
    });
    res.status(201).json({ status: 'ok', record });
  }),
);

ownerRouter.get(
  '/payments/:paymentId',
  asyncHandler(async (req, res) => {
    const record = await getOwnerPaymentRecord(req.user!.id, req.params.paymentId);
    res.json({ status: 'ok', record });
  }),
);

ownerRouter.get(
  '/inquiries',
  asyncHandler(async (req, res) => {
    const inquiries = await listOwnerInquiries(req.user!.id, parseOwnerInquiryQuery(req.query));
    res.json({ status: 'ok', ...inquiries });
  }),
);

ownerRouter.patch(
  '/inquiries/:inquiryId',
  asyncHandler(async (req, res) => {
    const input = parseBody(ownerInquiryReplySchema, req.body);
    const inquiry = await respondToOwnerInquiry(req.user!.id, req.params.inquiryId, input);
    res.json({ status: 'ok', inquiry });
  }),
);

ownerRouter.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await listOwnerReviews(req.user!.id, parseOwnerReviewQuery(req.query));
    res.json({ status: 'ok', ...reviews });
  }),
);

ownerRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const input = parseBody(ownerProfileSchema, req.body);
    const user = await updateOwnerProfile(req.user!.id, input);
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Owner profile');
    res.json({ status: 'ok', user });
  }),
);

ownerRouter.post(
  '/profile/avatar',
  parseAvatarUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a profile image to upload.');
    const user = await updateOwnerAvatar(req.user!.id, {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Owner profile avatar');
    res.json({ status: 'ok', user });
  }),
);

ownerRouter.delete(
  '/profile/avatar',
  asyncHandler(async (req, res) => {
    const user = await removeOwnerAvatar(req.user!.id);
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Owner profile avatar');
    res.json({ status: 'ok', user });
  }),
);

ownerRouter.get(
  '/verification',
  asyncHandler(async (req, res) => {
    const verification = await getOwnerVerification(req.user!.id);
    res.json({ status: 'ok', verification });
  }),
);

ownerRouter.post(
  '/verification',
  asyncHandler(async (req, res) => {
    const input = parseBody(ownerVerificationSchema, req.body);
    const verification = await submitOwnerVerification(req.user!.id, input);
    res.status(201).json({ status: 'ok', verification });
  }),
);

ownerRouter.get(
  '/properties/:propertyId/rooms',
  asyncHandler(async (req, res) => {
    const rooms = await listOwnerRooms(req.user!.id, req.params.propertyId);
    res.json({ status: 'ok', rooms });
  }),
);

ownerRouter.post(
  '/properties/:propertyId/rooms',
  asyncHandler(async (req, res) => {
    const input = parseBody(roomSchema, req.body);
    const room = await createOwnerRoom(req.user!.id, req.params.propertyId, input);
    res.status(201).json({ status: 'ok', room });
  }),
);

ownerRouter.put(
  '/rooms/:roomId',
  asyncHandler(async (req, res) => {
    const input = parseBody(roomSchema, req.body);
    const room = await updateOwnerRoom(req.user!.id, req.params.roomId, input);
    res.json({ status: 'ok', room });
  }),
);

ownerRouter.delete(
  '/rooms/:roomId',
  asyncHandler(async (req, res) => {
    await deleteOwnerRoom(req.user!.id, req.params.roomId);
    res.json({ status: 'ok' });
  }),
);
