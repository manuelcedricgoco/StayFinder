import { z } from 'zod';
import { passwordSchema } from './auth.validators';

export const roomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  monthlyPrice: z.number().int().min(100).max(1_000_000).nullable().optional(),
  capacity: z.number().int().min(1).max(50),
  isAvailable: z.boolean(),
});

export const ownerInquiryReplySchema = z.object({
  response: z.string().trim().min(2).max(2000).optional(),
  status: z.enum(['PENDING', 'RESPONDED', 'CLOSED']).optional(),
}).refine((value) => value.response !== undefined || value.status !== undefined, {
  message: 'Provide a response or an inquiry status.',
});

export const ownerProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phoneNumber: z.union([
    z.string().trim().regex(/^\+?[0-9 ()-]{7,30}$/, 'Enter a valid phone number.'),
    z.literal(''),
    z.null(),
  ]).optional(),
  avatarUrl: z.union([
    z.string().trim().max(2048).refine(
      (value) => value.startsWith('https://') || /^\/api\/uploads\/avatars\/[a-f0-9-]+\.(jpg|png|webp)$/.test(value),
      'Avatar must be an HTTPS URL or a stored profile image.',
    ),
    z.null(),
  ]),
});

export const ownerPreferencesSchema = z.object({
  defaultPropertyId: z.string().trim().max(100).nullable(),
  notifyNewInquiry: z.boolean(),
  notifyNewReview: z.boolean(),
  notifyListingStatus: z.boolean(),
  notifyVerification: z.boolean(),
  notifyPayment: z.boolean(),
  notifyAnnouncements: z.boolean(),
  emailNotifications: z.boolean(),
  inAppNotifications: z.boolean(),
});

export const ownerPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1).max(128),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ['confirmPassword'],
  message: 'New password and confirmation do not match.',
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ['newPassword'],
  message: 'New password must be different from the current password.',
});

export const ownerVerificationSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(7).max(30),
  documentType: z.enum(['NATIONAL_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'VOTERS_ID', 'OTHER']),
  documentUrl: z.string().trim().max(2048).url().refine((value) => value.startsWith('https://'), 'Document link must use HTTPS.'),
  additionalInfo: z.string().trim().max(1000).optional(),
});

export type RoomInput = z.infer<typeof roomSchema>;
export type OwnerInquiryReplyInput = z.infer<typeof ownerInquiryReplySchema>;
export type OwnerProfileInput = z.infer<typeof ownerProfileSchema>;
export type OwnerPreferencesInput = z.infer<typeof ownerPreferencesSchema>;
export type OwnerPasswordChangeInput = z.infer<typeof ownerPasswordChangeSchema>;
export type OwnerVerificationInput = z.infer<typeof ownerVerificationSchema>;
