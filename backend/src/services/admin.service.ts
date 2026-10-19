import type { OwnerVerificationStatus, ReportStatus, ReviewStatus } from '@prisma/client';
import { HttpError } from '../lib/HttpError';
import { removeStoredAvatar, saveAvatar } from '../lib/avatarStorage';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { publicUserSelect } from '../lib/publicUser';
import type { AdminProfileInput } from '../validators/admin.validators';

const notFound = () => new HttpError(404, 'Resource not found.');

export async function getAdminDashboardStats() {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [
    totalUsers,
    owners,
    boarders,
    administrators,
    totalProperties,
    pendingProperties,
    approvedProperties,
    rejectedProperties,
    inactiveProperties,
    verifiedOwners,
    pendingReviews,
    pendingReports,
    pendingVerifications,
    activeSessions,
    failedLoginAttempts,
    recentUsers,
    recentProperties,
    recentReviews,
    recentReports,
    recentVerifications,
    recentSecurityEvents,
    recentFailures,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'OWNER' } }),
    prisma.user.count({ where: { role: 'BOARDER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.property.count(),
    prisma.property.count({ where: { status: 'PENDING' } }),
    prisma.property.count({ where: { status: 'APPROVED' } }),
    prisma.property.count({ where: { status: 'REJECTED' } }),
    prisma.property.count({ where: { status: 'INACTIVE' } }),
    prisma.ownerVerification.count({ where: { status: 'APPROVED' } }),
    prisma.review.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.ownerVerification.count({ where: { status: 'PENDING' } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.securityEvent.count({ where: { action: 'LOGIN_FAILED' } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, role: true, createdAt: true },
    }),
    prisma.property.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, owner: { select: { name: true } } },
    }),
    prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, status: true, createdAt: true, updatedAt: true, boarder: { select: { name: true } }, property: { select: { name: true } } },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, status: true, createdAt: true, updatedAt: true, boarder: { select: { name: true } }, property: { select: { name: true } } },
    }),
    prisma.ownerVerification.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 8,
      select: { id: true, status: true, submittedAt: true, updatedAt: true, owner: { select: { name: true } } },
    }),
    prisma.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, status: true, target: true, userName: true, createdAt: true },
    }),
    prisma.securityEvent.findMany({
      where: { action: 'LOGIN_FAILED', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { email: true, ipAddress: true },
    }),
  ]);

  const failuresByEmail = new Map<string, number>();
  const failuresByIp = new Map<string, { count: number; emails: Set<string> }>();
  for (const failure of recentFailures) {
    if (failure.email) {
      const email = failure.email.toLowerCase();
      failuresByEmail.set(email, (failuresByEmail.get(email) ?? 0) + 1);
    }
    if (failure.ipAddress) {
      const group = failuresByIp.get(failure.ipAddress) ?? { count: 0, emails: new Set<string>() };
      group.count += 1;
      if (failure.email) group.emails.add(failure.email.toLowerCase());
      failuresByIp.set(failure.ipAddress, group);
    }
  }
  const suspiciousActivities = [...failuresByEmail.values()].filter((count) => count >= 5).length +
    [...failuresByIp.values()].filter((group) => group.count >= 5 && group.emails.size >= 3).length;

  const recentActivity = [
    ...recentUsers.map((user) => ({
      id: `user-${user.id}`,
      type: 'USER_REGISTERED',
      description: `New ${user.role.toLowerCase()} registered`,
      person: user.name,
      target: null,
      status: 'SUCCESS',
      createdAt: user.createdAt,
    })),
    ...recentProperties.map((property) => ({
      id: `property-${property.id}`,
      type: 'PROPERTY_SUBMITTED',
      description: property.status === 'APPROVED' ? 'Property approved' : property.status === 'REJECTED' ? 'Property rejected' : 'New property submitted',
      person: property.owner.name,
      target: property.name,
      status: property.status,
      createdAt: property.status === 'PENDING' ? property.createdAt : property.updatedAt,
    })),
    ...recentReviews.map((review) => ({
      id: `review-${review.id}`,
      type: 'REVIEW_SUBMITTED',
      description: review.status === 'PENDING' ? 'Review submitted' : `Review ${review.status.toLowerCase()}`,
      person: review.boarder.name,
      target: review.property.name,
      status: review.status,
      createdAt: review.status === 'PENDING' ? review.createdAt : review.updatedAt,
    })),
    ...recentReports.map((report) => ({
      id: `report-${report.id}`,
      type: 'REPORT_SUBMITTED',
      description: report.status === 'PENDING' ? 'Property report submitted' : `Property report ${report.status.toLowerCase()}`,
      person: report.boarder.name,
      target: report.property.name,
      status: report.status,
      createdAt: report.status === 'PENDING' ? report.createdAt : report.updatedAt,
    })),
    ...recentVerifications.map((verification) => ({
      id: `verification-${verification.id}`,
      type: 'VERIFICATION_SUBMITTED',
      description: verification.status === 'PENDING' ? 'Owner verification submitted' : `Owner verification ${verification.status.toLowerCase()}`,
      person: verification.owner.name,
      target: null,
      status: verification.status,
      createdAt: verification.status === 'PENDING' ? verification.submittedAt : verification.updatedAt,
    })),
    ...recentSecurityEvents.map((event) => ({
      id: `security-${event.id}`,
      type: event.action,
      description: event.action.toLowerCase().split('_').join(' '),
      person: event.userName ?? 'System',
      target: event.target,
      status: event.status,
      createdAt: event.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);

  const latestSecurityEvent = recentSecurityEvents[0];
  return {
    totalUsers,
    owners,
    boarders,
    administrators,
    totalProperties,
    pendingProperties,
    approvedProperties,
    rejectedProperties,
    inactiveProperties,
    verifiedOwners,
    pendingReviews,
    pendingReports,
    pendingVerifications,
    recentActivity,
    securitySummary: {
      failedLoginAttempts,
      activeSessions,
      suspiciousActivities,
      latestEvent: latestSecurityEvent
        ? {
            action: latestSecurityEvent.action,
            person: latestSecurityEvent.userName ?? 'System',
            createdAt: latestSecurityEvent.createdAt,
          }
        : null,
    },
  };
}

export async function listUsersForAdmin(options: {
  role?: 'ADMIN' | 'OWNER' | 'BOARDER';
  search?: string;
  page: number;
}) {
  const pageSize = 20;
  const where = {
    ...(options.role ? { role: options.role } : {}),
    ...(options.search
      ? {
          OR: [
            { name: { contains: options.search } },
            { email: { contains: options.search } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            properties: true,
            favorites: true,
            inquiriesSent: true,
            reviews: true,
            reports: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    users,
    pagination: { page: options.page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function updateAdminProfile(userId: string, input: AdminProfileInput) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!existing) throw new HttpError(404, 'Account not found.');

  let passwordHash: string | undefined;
  if (input.newPassword) {
    if (!existing.passwordHash) {
      throw new HttpError(400, 'This account does not have a password. Sign in with its linked provider.');
    }
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, existing.passwordHash))) {
      throw new HttpError(400, 'Current password is incorrect.', [
        { field: 'currentPassword', message: 'Enter your current password.' },
      ]);
    }
    passwordHash = await hashPassword(input.newPassword);
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      email: input.email,
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: publicUserSelect,
  });
}

export async function updateAdminAvatar(userId: string, file: { buffer: Buffer; mimeType: string }) {
  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  const avatarUrl = await saveAvatar(file.buffer, file.mimeType);
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: publicUserSelect,
    });
    await removeStoredAvatar(existing.avatarUrl).catch((error: unknown) => {
      console.error('Could not remove replaced admin avatar:', error);
    });
    return user;
  } catch (error) {
    await removeStoredAvatar(avatarUrl);
    throw error;
  }
}

export async function removeAdminAvatar(userId: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!existing) throw new HttpError(404, 'Account not found.');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: publicUserSelect,
  });
  await removeStoredAvatar(existing.avatarUrl);
  return user;
}

export async function getAdminExportSummary() {
  const [
    users,
    systemChecks,
    locations,
    amenities,
    properties,
    propertyImages,
    rooms,
    favorites,
    inquiries,
    reviews,
    reports,
    ownerVerifications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.systemCheck.count(),
    prisma.location.count(),
    prisma.amenity.count(),
    prisma.property.count(),
    prisma.propertyImage.count(),
    prisma.room.count(),
    prisma.favorite.count(),
    prisma.inquiry.count(),
    prisma.review.count(),
    prisma.report.count(),
    prisma.ownerVerification.count(),
  ]);

  return {
    users,
    systemChecks,
    locations,
    amenities,
    properties,
    propertyImages,
    rooms,
    favorites,
    inquiries,
    reviews,
    reports,
    ownerVerifications,
  };
}

export async function createAdminDataExport() {
  const [
    users,
    systemChecks,
    locations,
    amenities,
    properties,
    propertyImages,
    rooms,
    favorites,
    inquiries,
    reviews,
    reports,
    ownerVerifications,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.systemCheck.findMany(),
    prisma.location.findMany(),
    prisma.amenity.findMany(),
    prisma.property.findMany({ include: { images: true, rooms: true, amenities: true } }),
    prisma.propertyImage.findMany(),
    prisma.room.findMany(),
    prisma.favorite.findMany(),
    prisma.inquiry.findMany(),
    prisma.review.findMany(),
    prisma.report.findMany(),
    prisma.ownerVerification.findMany(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    excludedTables: ['sessions', 'oauth_accounts'],
    data: {
      users,
      systemChecks,
      locations,
      amenities,
      properties,
      propertyImages,
      rooms,
      favorites,
      inquiries,
      reviews,
      reports,
      ownerVerifications,
    },
  };
}

export async function listReviewsForAdmin(status?: ReviewStatus) {
  return prisma.review.findMany({
    where: status ? { status } : {},
    select: {
      id: true,
      rating: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      boarder: { select: { id: true, name: true } },
      property: { select: { id: true, name: true, owner: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
}

export async function setReviewStatus(id: string, status: ReviewStatus) {
  const result = await prisma.review.updateMany({ where: { id }, data: { status } });
  if (!result.count) throw notFound();
  return prisma.review.findUniqueOrThrow({
    where: { id },
    select: { id: true, rating: true, content: true, status: true, updatedAt: true },
  });
}

export async function listReportsForAdmin(status?: ReportStatus) {
  return prisma.report.findMany({
    where: status ? { status } : {},
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      boarder: { select: { id: true, name: true } },
      property: { select: { id: true, name: true, status: true, owner: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
}

export async function setReportStatus(id: string, status: ReportStatus) {
  const result = await prisma.report.updateMany({ where: { id }, data: { status } });
  if (!result.count) throw notFound();
  return prisma.report.findUniqueOrThrow({
    where: { id },
    select: { id: true, reason: true, details: true, status: true, updatedAt: true },
  });
}

export async function listVerificationsForAdmin(status?: OwnerVerificationStatus) {
  return prisma.ownerVerification.findMany({
    where: status ? { status } : {},
    select: {
      id: true,
      legalName: true,
      phoneNumber: true,
      documentType: true,
      documentUrl: true,
      additionalInfo: true,
      status: true,
      rejectionReason: true,
      submittedAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { submittedAt: 'asc' },
    take: 200,
  });
}

export async function setVerificationStatus(
  id: string,
  status: OwnerVerificationStatus,
  rejectionReason?: string,
) {
  const updated = await prisma.ownerVerification.updateMany({
    where: { id },
    data: {
      status,
      rejectionReason: status === 'REJECTED' ? rejectionReason : null,
    },
  });
  if (!updated.count) throw notFound();
  return prisma.ownerVerification.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      legalName: true,
      status: true,
      rejectionReason: true,
      submittedAt: true,
      updatedAt: true,
    },
  });
}
