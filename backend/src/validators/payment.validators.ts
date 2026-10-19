import { z } from 'zod';

export const paymentMethods = ['CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'OTHER'] as const;

export const paymentRecordSchema = z.object({
  propertyId: z.string().trim().min(1).max(100),
  roomId: z.string().trim().min(1).max(100).optional().nullable(),
  boarderName: z.string().trim().min(2).max(120),
  amount: z.number().int().min(1).max(100_000_000),
  paymentDate: z.string()
    .datetime({ offset: true })
    .refine((value) => new Date(value).getTime() <= Date.now(), 'Payment date cannot be in the future.'),
  paymentMethod: z.enum(paymentMethods),
  referenceNumber: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type PaymentRecordInput = z.infer<typeof paymentRecordSchema>;
