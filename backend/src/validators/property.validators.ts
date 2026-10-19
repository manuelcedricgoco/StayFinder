import { z } from 'zod';
import { HttpError } from '../lib/HttpError';

export const PROPERTY_TYPES = ['BOARDING_HOUSE', 'APARTMENT', 'ROOM', 'BEDSPACE'] as const;
export const AVAILABILITIES = ['AVAILABLE', 'FULLY_OCCUPIED', 'COMING_SOON'] as const;
export const PROPERTY_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'INACTIVE'] as const;
// Admins cannot move a listing back to PENDING; only an owner edit does that.
export const ADMIN_SETTABLE_STATUSES = ['APPROVED', 'REJECTED', 'INACTIVE'] as const;
export const MAX_IMAGES = 10;
export const PROPERTY_SORTS = ['NEWEST', 'PRICE_ASC', 'PRICE_DESC'] as const;

// z.string().url() also accepts "javascript:..." so we additionally require https://.
const imageUrlSchema = z
  .string({ invalid_type_error: 'Image URL must be text.' })
  .trim()
  .max(2048, 'Image URL is too long.')
  .url('Enter a valid image URL.')
  .refine((url) => url.startsWith('https://'), 'Image URLs must start with https://');

// Used for both creating and updating. Unknown keys (status, ownerId, id, ...) are dropped,
// so an owner can never choose their own status or owner.
export const propertySchema = z
  .object({
    name: z
      .string({ required_error: 'Property name is required.' })
      .trim()
      .min(3, 'Property name must be at least 3 characters.')
      .max(100, 'Property name must be 100 characters or fewer.'),
    propertyType: z.enum(PROPERTY_TYPES, {
      errorMap: () => ({ message: 'Choose a valid property type.' }),
    }),
    description: z
      .string({ required_error: 'Description is required.' })
      .trim()
      .min(20, 'Description must be at least 20 characters.')
      .max(2000, 'Description must be 2000 characters or fewer.'),
    monthlyPrice: z
      .number({
        required_error: 'Monthly price is required.',
        invalid_type_error: 'Monthly price must be a number.',
      })
      .int('Monthly price must be a whole number of pesos.')
      .min(100, 'Monthly price must be at least ₱100.')
      .max(1_000_000, 'Monthly price must be ₱1,000,000 or less.'),
    municipality: z
      .string({ required_error: 'Municipality is required.' })
      .trim()
      .min(1, 'Municipality is required.')
      .max(60, 'Municipality is too long.'),
    address: z
      .string({ required_error: 'Address is required.' })
      .trim()
      .min(5, 'Address must be at least 5 characters.')
      .max(200, 'Address must be 200 characters or fewer.'),
    availableRooms: z
      .number({
        required_error: 'Available rooms is required.',
        invalid_type_error: 'Available rooms must be a number.',
      })
      .int('Available rooms must be a whole number.')
      .min(0, 'Available rooms cannot be negative.')
      .max(999, 'Available rooms is too large.'),
    availability: z.enum(AVAILABILITIES, {
      errorMap: () => ({ message: 'Choose a valid availability.' }),
    }),
    // Amenity slugs from GET /api/amenities, e.g. ["wifi", "parking"]
    amenities: z
      .array(z.string().regex(/^[a-z0-9-]{1,40}$/, 'Invalid amenity.'))
      .max(30, 'Too many amenities selected.')
      .default([])
      .transform((slugs) => [...new Set(slugs)]),
    imageUrls: z
      .array(imageUrlSchema)
      .max(MAX_IMAGES, `You can add up to ${MAX_IMAGES} images.`)
      .default([]),
    // Optional, for the future map feature (both or neither)
    latitude: z.number().min(-90, 'Latitude must be between -90 and 90.').max(90, 'Latitude must be between -90 and 90.').nullable().optional(),
    longitude: z.number().min(-180, 'Longitude must be between -180 and 180.').max(180, 'Longitude must be between -180 and 180.').nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.availability === 'AVAILABLE' && data.availableRooms < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['availableRooms'],
        message: 'A listing marked Available needs at least 1 available room.',
      });
    }
    if ((data.latitude == null) !== (data.longitude == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Provide both latitude and longitude, or neither.',
      });
    }
  });

export const adminStatusSchema = z
  .object({
    status: z.enum(ADMIN_SETTABLE_STATUSES, {
      errorMap: () => ({ message: 'Status must be APPROVED, REJECTED or INACTIVE.' }),
    }),
    rejectionReason: z
      .string()
      .trim()
      .min(5, 'Please give a reason of at least 5 characters.')
      .max(500, 'Reason must be 500 characters or fewer.')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'REJECTED' && !data.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message: 'A reason is required when rejecting a listing.',
      });
    }
  });

export type PropertyInput = z.infer<typeof propertySchema>;
export type AdminStatusInput = z.infer<typeof adminStatusSchema>;

const optionalQueryNumber = (max: number) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(0).max(max).optional(),
  );

export const publicPropertySearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  municipality: z.string().trim().max(60).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  minPrice: optionalQueryNumber(1_000_000),
  maxPrice: optionalQueryNumber(1_000_000),
  availability: z.enum(AVAILABILITIES).optional(),
  amenities: z.string().max(400).optional(),
  page: z.preprocess(
    (value) => (value === undefined || value === '' ? 1 : value),
    z.coerce.number().int().min(1).max(10_000),
  ),
  sort: z.enum(PROPERTY_SORTS).default('NEWEST'),
}).superRefine((query, ctx) => {
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxPrice'],
      message: 'Maximum price must be greater than or equal to minimum price.',
    });
  }

  if (query.amenities) {
    const slugs = query.amenities.split(',');
    if (slugs.length > 30 || slugs.some((slug) => !/^[a-z0-9-]{1,40}$/.test(slug))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amenities'],
        message: 'Choose valid amenities.',
      });
    }
  }
});

export type PublicPropertySearchInput = z.infer<typeof publicPropertySearchSchema>;

// Reads ?status=PENDING from a query string. Missing = no filter, invalid = 400.
export function parseStatusFilter(value: unknown): (typeof PROPERTY_STATUSES)[number] | undefined {
  if (value === undefined) return undefined;
  const result = z.enum(PROPERTY_STATUSES).safeParse(value);
  if (!result.success) {
    throw new HttpError(400, `Invalid status filter. Use one of: ${PROPERTY_STATUSES.join(', ')}.`);
  }
  return result.data;
}
