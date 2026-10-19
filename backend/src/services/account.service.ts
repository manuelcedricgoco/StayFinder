import type { Role } from '@prisma/client';
import { removeStoredAvatar, saveAvatar } from '../lib/avatarStorage';
import { HttpError } from '../lib/HttpError';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/publicUser';
import type { OwnerPasswordChangeInput, OwnerProfileInput } from '../validators/owner.validators';
import { hashSessionToken } from './session.service';

const notFound = () => new HttpError(404, 'Account not found.');

export async function updateAccountProfile(userId: string, input: OwnerProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      avatarUrl: input.avatarUrl,
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber?.trim() || null } : {}),
    },
    select: publicUserSelect,
  });
}

export async function updateAccountAvatar(userId: string, file: { buffer: Buffer; mimeType: string }) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!existing) throw notFound();
  const avatarUrl = await saveAvatar(file.buffer, file.mimeType);
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: publicUserSelect,
    });
    await removeStoredAvatar(existing.avatarUrl).catch((error: unknown) => {
      console.error('Could not remove replaced account avatar:', error);
    });
    return user;
  } catch (error) {
    await removeStoredAvatar(avatarUrl);
    throw error;
  }
}

export async function removeAccountAvatar(userId: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!existing) throw notFound();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: publicUserSelect,
  });
  await removeStoredAvatar(existing.avatarUrl);
  return user;
}

export async function changeAccountPassword(
  userId: string,
  role: Role,
  input: OwnerPasswordChangeInput,
  currentToken: string,
  context: { ipAddress: string | null; userAgent: string | null },
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, name: true, email: true },
  });
  if (!existing) throw notFound();
  if (!existing.passwordHash) {
    throw new HttpError(409, 'This account uses a linked sign-in provider and has no local password to change.');
  }
  if (!(await verifyPassword(input.currentPassword, existing.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect.', [
      { field: 'currentPassword', message: 'Enter your current password.' },
    ]);
  }

  const passwordHash = await hashPassword(input.newPassword);
  const currentTokenHash = hashSessionToken(currentToken);
  await prisma.$transaction(async (transaction) => {
    const changed = await transaction.user.updateMany({
      where: { id: userId, passwordHash: existing.passwordHash },
      data: { passwordHash },
    });
    if (changed.count !== 1) throw new HttpError(409, 'Your password changed in another request. Please try again.');
    await transaction.session.deleteMany({
      where: { userId, tokenHash: { not: currentTokenHash } },
    });
    await transaction.securityEvent.create({
      data: {
        userId,
        userName: existing.name,
        email: existing.email,
        role,
        action: 'PASSWORD_CHANGED',
        target: 'Account password',
        status: 'SUCCESS',
        ...context,
      },
    });
  });
}
