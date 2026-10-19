import { Prisma } from '@prisma/client';
import multer from 'multer';
import { Router, type RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { MAX_AVATAR_SIZE } from '../lib/avatarStorage';
import { HttpError } from '../lib/HttpError';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  createAdminDataExport,
  getAdminExportSummary,
  getAdminDashboardStats,
  listUsersForAdmin,
  removeAdminAvatar,
  updateAdminAvatar,
  updateAdminProfile,
  listReportsForAdmin,
  listReviewsForAdmin,
  listVerificationsForAdmin,
  setReportStatus,
  setReviewStatus,
  setVerificationStatus,
} from '../services/admin.service';
import { getPlatformSettings, updatePlatformSettings } from '../services/platformSettings.service';
import {
  actorSecurityEvent,
  getSecurityDashboard,
  listSecurityEvents,
  requestSecurityContext,
  revokeSecuritySession,
  securityCsvCell,
  type SecurityFilters,
} from '../services/security.service';
import {
  adminReportStatusSchema,
  adminProfileSchema,
  adminReviewStatusSchema,
  adminVerificationStatusSchema,
  parseReportStatusFilter,
  parseAdminUserPage,
  parseAdminUserRoleFilter,
  parseAdminUserSearch,
  parseReviewStatusFilter,
  parseVerificationStatusFilter,
  type AdminReportStatusInput,
  type AdminProfileInput,
  type AdminReviewStatusInput,
  type AdminVerificationStatusInput,
} from '../validators/admin.validators';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new HttpError(400, 'Upload a JPEG, PNG, or WebP image.'));
    }
  },
});

const parseAvatarUpload: RequestHandler = (req, res, next) => {
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

const platformSettingsSchema = z.object({
  siteName: z.string().trim().min(2).max(60),
  allowRegistrations: z.boolean(),
  autoApproveListings: z.boolean(),
});

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

function parseSecurityFilters(query: Record<string, unknown>): SecurityFilters {
  const read = (key: string) => {
    const value = query[key];
    return typeof value === 'string' ? value.trim().slice(0, 100) : undefined;
  };
  const fromValue = read('from');
  const toValue = read('to');
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((fromValue && !datePattern.test(fromValue)) || (toValue && !datePattern.test(toValue))) {
    throw new HttpError(400, 'Date filters must use YYYY-MM-DD format.');
  }
  const fromDate = fromValue ? new Date(`${fromValue}T00:00:00.000Z`) : null;
  const toDate = toValue ? new Date(`${toValue}T23:59:59.999Z`) : null;
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    throw new HttpError(400, 'Date filter is invalid.');
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new HttpError(400, 'Start date must not be after end date.');
  }
  const role = read('role');
  if (role && !['ADMIN', 'OWNER', 'BOARDER'].includes(role)) {
    throw new HttpError(400, 'Role filter is invalid.');
  }
  return {
    from: fromDate?.toISOString(),
    to: toDate?.toISOString(),
    user: read('user') || undefined,
    role: role as SecurityFilters['role'],
    action: read('action') || undefined,
    status: read('status') || undefined,
    ip: read('ip') || undefined,
    q: read('q') || undefined,
  };
}

adminRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const stats = await getAdminDashboardStats();
    res.json({ status: 'ok', area: 'admin', stats });
  }),
);

adminRouter.get(
  '/security',
  asyncHandler(async (req, res) => {
    const dashboard = await getSecurityDashboard(parseSecurityFilters(req.query));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', ...dashboard });
  }),
);

adminRouter.get(
  '/security/export.csv',
  asyncHandler(async (req, res) => {
    const events = await listSecurityEvents(parseSecurityFilters(req.query));
    const rows = [
      ['Date/time', 'User', 'Email', 'Role', 'Action', 'Target/resource', 'IP address', 'Status'],
      ...events.map((event) => [
        event.createdAt,
        event.userName,
        event.email,
        event.role,
        event.action,
        event.target,
        event.ipAddress,
        event.status,
      ]),
    ];
    const csv = rows.map((row) => row.map(securityCsvCell).join(',')).join('\r\n');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="stayfinder-security-logs.csv"');
    res.send(`\uFEFF${csv}`);
  }),
);

adminRouter.delete(
  '/security/sessions/:sessionId',
  asyncHandler(async (req, res) => {
    const revoked = await revokeSecuritySession(
      req.params.sessionId,
      req.user!,
      requestSecurityContext(req),
    );
    if (!revoked) throw new HttpError(404, 'Active session not found.');
    res.json({ status: 'ok' });
  }),
);

adminRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const settings = await getPlatformSettings();
    res.json({ status: 'ok', settings });
  }),
);

adminRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const input = parseBody(platformSettingsSchema, req.body);
    const settings = await updatePlatformSettings(input);
    await actorSecurityEvent(req, 'PLATFORM_SETTINGS_CHANGED', 'Platform settings');
    res.json({ status: 'ok', settings });
  }),
);

adminRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const input = parseBody<AdminProfileInput>(adminProfileSchema, req.body);
    try {
      const user = await updateAdminProfile(req.user!.id, input);
      await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Admin profile');
      res.json({ status: 'ok', user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'An account with this email already exists.', [
          { field: 'email', message: 'An account with this email already exists.' },
        ]);
      }
      throw error;
    }
  }),
);

adminRouter.post(
  '/profile/avatar',
  parseAvatarUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a profile image to upload.');
    const user = await updateAdminAvatar(req.user!.id, {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Admin profile avatar');
    res.json({ status: 'ok', user });
  }),
);

adminRouter.delete(
  '/profile/avatar',
  asyncHandler(async (req, res) => {
    const user = await removeAdminAvatar(req.user!.id);
    await actorSecurityEvent(req, 'PROFILE_UPDATED', 'Admin profile avatar');
    res.json({ status: 'ok', user });
  }),
);

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await getAdminDashboardStats();
    res.json({ status: 'ok', stats });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const result = await listUsersForAdmin({
      role: parseAdminUserRoleFilter(req.query.role),
      search: parseAdminUserSearch(req.query.q),
      page: parseAdminUserPage(req.query.page),
    });
    res.json({ status: 'ok', ...result });
  }),
);

adminRouter.get(
  '/export/summary',
  asyncHandler(async (_req, res) => {
    const counts = await getAdminExportSummary();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', counts });
  }),
);

adminRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const dataExport = await createAdminDataExport();
    await actorSecurityEvent(req, 'DATABASE_EXPORTED', 'Database export');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="stayfinder-database-export.json"');
    res.json(dataExport);
  }),
);

adminRouter.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await listReviewsForAdmin(parseReviewStatusFilter(req.query.status));
    res.json({ status: 'ok', reviews });
  }),
);

adminRouter.patch(
  '/reviews/:reviewId/status',
  asyncHandler(async (req, res) => {
    const input = parseBody<AdminReviewStatusInput>(adminReviewStatusSchema, req.body);
    const review = await setReviewStatus(req.params.reviewId, input.status);
    await actorSecurityEvent(req, 'REVIEW_MODERATED', `Review ${req.params.reviewId}: ${input.status}`);
    res.json({ status: 'ok', review });
  }),
);

adminRouter.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const reports = await listReportsForAdmin(parseReportStatusFilter(req.query.status));
    res.json({ status: 'ok', reports });
  }),
);

adminRouter.patch(
  '/reports/:reportId/status',
  asyncHandler(async (req, res) => {
    const input = parseBody<AdminReportStatusInput>(adminReportStatusSchema, req.body);
    const report = await setReportStatus(req.params.reportId, input.status);
    await actorSecurityEvent(req, 'REPORT_RESOLVED', `Report ${req.params.reportId}: ${input.status}`);
    res.json({ status: 'ok', report });
  }),
);

adminRouter.get(
  '/verifications',
  asyncHandler(async (req, res) => {
    const verifications = await listVerificationsForAdmin(parseVerificationStatusFilter(req.query.status));
    res.json({ status: 'ok', verifications });
  }),
);

adminRouter.patch(
  '/verifications/:verificationId/status',
  asyncHandler(async (req, res) => {
    const input = parseBody<AdminVerificationStatusInput>(adminVerificationStatusSchema, req.body);
    const verification = await setVerificationStatus(
      req.params.verificationId,
      input.status,
      input.rejectionReason,
    );
    await actorSecurityEvent(req, 'VERIFICATION_MODERATED', `Verification ${req.params.verificationId}: ${input.status}`);
    res.json({ status: 'ok', verification });
  }),
);
