import { createHash, randomBytes } from 'node:crypto';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { publicUserSelect, type PublicUser } from '../lib/publicUser';

// The browser holds the random token; the database only holds its hash,
// so a leaked database cannot be used to log in.
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  context: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent?.slice(0, 500) ?? null,
    },
  });
  return { token, expiresAt };
}

export async function findUserBySessionToken(token: string): Promise<PublicUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, expiresAt: true, lastActivityAt: true, user: { select: publicUserSelect } },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const activityCutoff = new Date(Date.now() - 60_000);
  if (session.lastActivityAt < activityCutoff) {
    await prisma.session.updateMany({
      where: { id: session.id, lastActivityAt: { lt: activityCutoff } },
      data: { lastActivityAt: new Date() },
    });
  }
  return session.user;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function listUserSessions(userId: string, currentToken: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastActivityAt: 'desc' },
    select: {
      id: true,
      tokenHash: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastActivityAt: true,
      expiresAt: true,
    },
  });
  const currentHash = hashSessionToken(currentToken);
  return sessions.map(({ tokenHash, ...session }) => ({
    ...session,
    isCurrent: tokenHash === currentHash,
  }));
}

export async function revokeOtherUserSessions(
  userId: string,
  currentToken: string,
  actor: { name: string; email: string; role: Role },
  context: { ipAddress: string | null; userAgent: string | null },
) {
  const currentHash = hashSessionToken(currentToken);
  return prisma.$transaction(async (transaction) => {
    const currentSession = await transaction.session.findFirst({
      where: { userId, tokenHash: currentHash, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!currentSession) return 0;

    const revoked = await transaction.session.deleteMany({
      where: { userId, id: { not: currentSession.id }, expiresAt: { gt: new Date() } },
    });
    if (revoked.count > 0) {
      await transaction.securityEvent.create({
        data: {
          userId,
          userName: actor.name,
          email: actor.email,
          role: actor.role,
          action: 'OTHER_SESSIONS_REVOKED',
          target: `${revoked.count} other session(s)`,
          status: 'SUCCESS',
          ...context,
        },
      });
    }
    return revoked.count;
  });
}
