import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface SecurityEventInput {
  action: string;
  status: string;
  target?: string | null;
  userId?: string | null;
  userName?: string | null;
  email?: string | null;
  role?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function requestSecurityContext(req: Request) {
  return {
    ipAddress: (req.ip || req.socket.remoteAddress || '').slice(0, 100) || null,
    userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
  };
}

export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      action: input.action.slice(0, 80),
      status: input.status.slice(0, 40),
      target: input.target?.slice(0, 200) ?? null,
      userId: input.userId ?? null,
      userName: input.userName?.slice(0, 120) ?? null,
      email: input.email?.slice(0, 254) ?? null,
      role: input.role?.slice(0, 40) ?? null,
      ipAddress: input.ipAddress?.slice(0, 100) ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    },
  });
}

// Per-account brute-force protection: after this many LOGIN_FAILED events for
// one email address within the window, logins for that account are refused
// before any password hashing work is done.
export const LOGIN_THROTTLE_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export async function isLoginThrottled(email: string): Promise<boolean> {
  const failedAttempts = await prisma.securityEvent.count({
    where: {
      action: 'LOGIN_FAILED',
      status: 'FAILED',
      email: { equals: email },
      createdAt: { gte: new Date(Date.now() - LOGIN_THROTTLE_WINDOW_MS) },
    },
  });
  return failedAttempts >= LOGIN_THROTTLE_MAX_FAILED_ATTEMPTS;
}

export function actorSecurityEvent(
  req: Request,
  action: string,
  target: string,
  status = 'SUCCESS',
) {
  const context = requestSecurityContext(req);
  return recordSecurityEvent({
    action,
    target,
    status,
    userId: req.user?.id,
    userName: req.user?.name,
    email: req.user?.email,
    role: req.user?.role,
    ...context,
  });
}

export interface SecurityFilters {
  from?: string;
  to?: string;
  user?: string;
  role?: Role;
  action?: string;
  status?: string;
  ip?: string;
  q?: string;
}

function eventWhere(filters: SecurityFilters) {
  const where: {
    createdAt?: { gte?: Date; lte?: Date };
    role?: string;
    action?: { contains: string };
    status?: { contains: string };
    ipAddress?: { contains: string };
    OR?: Array<Record<string, unknown>>;
    AND?: Array<Record<string, unknown>>;
  } = {};
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lte = new Date(filters.to);
  }
  if (filters.role) where.role = filters.role;
  if (filters.action) where.action = { contains: filters.action };
  if (filters.status) where.status = { contains: filters.status };
  if (filters.ip) where.ipAddress = { contains: filters.ip };
  if (filters.user) {
    where.OR = [
      { userName: { contains: filters.user } },
      { email: { contains: filters.user } },
    ];
  }
  if (filters.q) {
    where.AND = [
      {
        OR: [
          { userName: { contains: filters.q } },
          { email: { contains: filters.q } },
          { action: { contains: filters.q } },
          { target: { contains: filters.q } },
        ],
      },
    ];
  }
  return where;
}

function safeRole(value: string | null): Role | null {
  return value === 'ADMIN' || value === 'OWNER' || value === 'BOARDER' ? value : null;
}

export async function getSecurityDashboard(filters: SecurityFilters) {
  const now = new Date();
  const eventsWhere = eventWhere(filters);
  const [loginAttempts, successfulLogins, failedLogins, blockedAccounts, activeSessions, events, sessions, failures] =
    await Promise.all([
      prisma.securityEvent.count({ where: { action: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] } } }),
      prisma.securityEvent.count({ where: { action: 'LOGIN_SUCCESS' } }),
      prisma.securityEvent.count({ where: { action: 'LOGIN_FAILED' } }),
      Promise.resolve(0),
      prisma.session.count({ where: { expiresAt: { gt: now } } }),
      prisma.securityEvent.findMany({
        where: eventsWhere,
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      prisma.session.findMany({
        where: { expiresAt: { gt: now } },
        orderBy: { lastActivityAt: 'desc' },
        take: 100,
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          lastActivityAt: true,
          expiresAt: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.securityEvent.findMany({
        where: { action: 'LOGIN_FAILED', createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

  const failedByEmail = new Map<string, typeof failures>();
  const failedByIp = new Map<string, typeof failures>();
  for (const failure of failures) {
    const emailKey = failure.email?.toLowerCase();
    if (emailKey) failedByEmail.set(emailKey, [...(failedByEmail.get(emailKey) ?? []), failure]);
    if (failure.ipAddress) {
      failedByIp.set(failure.ipAddress, [...(failedByIp.get(failure.ipAddress) ?? []), failure]);
    }
  }
  const suspicious = [
    ...[...failedByEmail.values()]
    .filter((group) => group.length >= 5)
    .map((group) => ({
      id: `failed-${group[0].id}`,
      createdAt: group[0].createdAt,
      label: 'Potentially Suspicious',
      description: `${group.length} failed login attempts in 15 minutes`,
      user: group[0].userName ?? group[0].email ?? 'Unknown account',
      ipAddress: group[0].ipAddress,
      status: 'REVIEW',
    })),
    ...[...failedByIp.values()]
      .filter((group) => group.length >= 5 && new Set(group.map((event) => event.email).filter(Boolean)).size >= 3)
      .map((group) => ({
        id: `ip-${group[0].id}`,
        createdAt: group[0].createdAt,
        label: 'Potentially Suspicious',
        description: `${group.length} failed login attempts across multiple accounts from one IP in 15 minutes`,
        user: 'Multiple account identifiers',
        ipAddress: group[0].ipAddress,
        status: 'REVIEW',
      })),
  ];

  const loginActivity = events
    .filter((event) => event.action === 'LOGIN_SUCCESS' || event.action === 'LOGIN_FAILED')
    .slice(0, 100)
    .map((event) => ({
      ...event,
      role: safeRole(event.role),
      loginStatus: event.action === 'LOGIN_SUCCESS' ? 'SUCCESSFUL' : 'FAILED',
    }));

  return {
    overview: {
      loginAttempts,
      successfulLogins,
      failedLogins,
      activeSessions,
      suspiciousActivities: suspicious.length,
      blockedAccounts,
      blockedAccountsAvailable: false,
    },
    loginActivity,
    auditLogs: events.map((event) => ({ ...event, role: safeRole(event.role) })),
    suspicious,
    sessions: sessions.map((session) => ({
      id: session.id,
      user: session.user,
      role: session.user.role,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      loginAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      status: 'ACTIVE',
    })),
    accountSecurity: {
      twoFactorAuthentication: { available: false },
      passwordPolicy: { available: false },
      sessionTimeout: { available: false },
      maximumFailedLoginAttempts: { available: false },
      accountLockoutDuration: { available: false },
    },
  };
}

export async function listSecurityEvents(filters: SecurityFilters) {
  return prisma.securityEvent.findMany({
    where: eventWhere(filters),
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeSecuritySession(sessionId: string, admin: {
  id: string; name: string; email: string; role: Role;
}, context: { ipAddress: string | null; userAgent: string | null }) {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, expiresAt: { gt: new Date() } },
    select: { userId: true, user: { select: { name: true, email: true, role: true } } },
  });
  if (!session) return false;
  await prisma.$transaction([
    prisma.session.delete({ where: { id: sessionId } }),
    prisma.securityEvent.create({
      data: {
        userId: admin.id,
        userName: admin.name,
        email: admin.email,
        role: admin.role,
        action: 'SESSION_REVOKED',
        target: `${session.user.name} (${session.user.email})`,
        status: 'SUCCESS',
        ...context,
      },
    }),
  ]);
  return true;
}

export function securityCsvCell(value: string | Date | null | undefined): string {
  let text = value instanceof Date ? value.toISOString() : value ?? '';
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
