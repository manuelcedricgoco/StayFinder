import type { Prisma } from '@prisma/client';

// The ONLY user fields that may ever be sent to a client.
// Using `select: publicUserSelect` means passwordHash is never even loaded.
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

// Explicit allowlist: safe to call with a record that also contains passwordHash.
export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
