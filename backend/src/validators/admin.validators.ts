import { z } from 'zod';
import { HttpError } from '../lib/HttpError';
import { emailSchema, passwordSchema } from './auth.validators';

export const adminReviewStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const adminReportStatusSchema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
});

export const adminVerificationStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().min(5).max(500).optional(),
}).superRefine((value, context) => {
  if (value.status === 'REJECTED' && !value.rejectionReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionReason'],
      message: 'A reason is required when rejecting verification.',
    });
  }
});

export const adminProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: passwordSchema.optional(),
}).superRefine((value, context) => {
  if (value.newPassword && !value.currentPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currentPassword'],
      message: 'Enter your current password to set a new password.',
    });
  }
});

function parseFilter<T extends string>(value: unknown, values: readonly [T, ...T[]], label: string) {
  if (value === undefined) return undefined;
  const result = z.enum(values).safeParse(value);
  if (!result.success) throw new HttpError(400, `Invalid ${label} filter.`);
  return result.data;
}

export const parseReviewStatusFilter = (value: unknown) =>
  parseFilter(value, ['PENDING', 'APPROVED', 'REJECTED'], 'review status');

export const parseReportStatusFilter = (value: unknown) =>
  parseFilter(value, ['PENDING', 'RESOLVED', 'REJECTED'], 'report status');

export const parseVerificationStatusFilter = (value: unknown) =>
  parseFilter(value, ['PENDING', 'APPROVED', 'REJECTED'], 'verification status');

export const parseAdminUserRoleFilter = (value: unknown) =>
  parseFilter(value, ['ADMIN', 'OWNER', 'BOARDER'], 'user role');

export function parseAdminUserSearch(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const result = z.string().trim().max(100).safeParse(value);
  if (!result.success) throw new HttpError(400, 'Invalid user search.');
  return result.data || undefined;
}

export function parseAdminUserPage(value: unknown): number {
  if (value === undefined) return 1;
  const result = z.string().regex(/^[1-9]\d*$/).transform(Number)
    .refine((page) => Number.isSafeInteger(page) && page <= 1_000_000)
    .safeParse(value);
  if (!result.success) throw new HttpError(400, 'Invalid user page.');
  return result.data;
}

export type AdminReviewStatusInput = z.infer<typeof adminReviewStatusSchema>;
export type AdminReportStatusInput = z.infer<typeof adminReportStatusSchema>;
export type AdminVerificationStatusInput = z.infer<typeof adminVerificationStatusSchema>;
export type AdminProfileInput = z.infer<typeof adminProfileSchema>;
