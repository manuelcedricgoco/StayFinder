import { z } from 'zod';

export const emailSchema = z
  .string({ required_error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254, 'Email is too long.');

export const passwordSchema = z
  .string({ required_error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/\d/, 'Password must contain at least one number.');

// Only OWNER and BOARDER can self-register. ADMIN accounts are created with `npm run db:seed`.
export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(80, 'Name must be 80 characters or fewer.'),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['OWNER', 'BOARDER'], {
    errorMap: () => ({ message: 'Choose a valid account type.' }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(128, 'Password is too long.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
