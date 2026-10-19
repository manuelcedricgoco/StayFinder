import { z } from 'zod';
import { ownerPasswordChangeSchema, ownerProfileSchema } from './owner.validators';

export const boarderProfileSchema = ownerProfileSchema;
export const boarderPasswordChangeSchema = ownerPasswordChangeSchema;

export const boarderPreferencesSchema = z.object({
  preferredLocationId: z.string().trim().max(100).nullable(),
  minBudget: z.number().int().min(0).max(1_000_000).nullable(),
  maxBudget: z.number().int().min(0).max(1_000_000).nullable(),
  propertyType: z.enum(['BOARDING_HOUSE', 'APARTMENT', 'ROOM', 'BEDSPACE']).nullable(),
  occupants: z.number().int().min(1).max(50).nullable(),
  preferredAmenityIds: z.array(z.string().trim().min(1).max(100)).max(30),
  notifyInquiryReplies: z.boolean(),
  notifyFavoriteUpdates: z.boolean(),
  notifyListingUpdates: z.boolean(),
  notifyReviewUpdates: z.boolean(),
  notifyAnnouncements: z.boolean(),
  emailNotifications: z.boolean(),
  inAppNotifications: z.boolean(),
}).refine(
  (value) => value.minBudget === null || value.maxBudget === null || value.maxBudget >= value.minBudget,
  { path: ['maxBudget'], message: 'Maximum budget must be at least the minimum budget.' },
);

export const inquirySchema = z.object({
  propertyId: z.string().min(1).max(30),
  message: z.string().trim().min(10).max(2000),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(10).max(2000),
});

export const reportSchema = z.object({
  reason: z.enum([
    'FAKE_PROPERTY',
    'SCAM',
    'INCORRECT_INFORMATION',
    'INAPPROPRIATE_CONTENT',
    'PROPERTY_UNAVAILABLE',
    'OTHER',
  ]),
  details: z.string().trim().max(1000).optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type BoarderPreferencesInput = z.infer<typeof boarderPreferencesSchema>;
