// Owner account settings: profile, avatar, preferences, sessions and password.
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/HttpError';
import { listUserSessions } from '../session.service';
import {
  changeAccountPassword,
  removeAccountAvatar,
  updateAccountAvatar,
  updateAccountProfile,
} from '../account.service';
import type {
  OwnerPasswordChangeInput,
  OwnerPreferencesInput,
  OwnerProfileInput,
} from '../../validators/owner.validators';
import { notFound } from './shared';

export async function updateOwnerProfile(ownerId: string, input: OwnerProfileInput) {
  return updateAccountProfile(ownerId, input);
}

export async function getOwnerSettings(ownerId: string, currentToken: string) {
  const preferences = await prisma.ownerPreferences.upsert({
    where: { ownerId },
    create: { ownerId },
    update: {},
    select: {
      defaultPropertyId: true,
      notifyNewInquiry: true,
      notifyNewReview: true,
      notifyListingStatus: true,
      notifyVerification: true,
      notifyPayment: true,
      notifyAnnouncements: true,
      emailNotifications: true,
      inAppNotifications: true,
    },
  });
  const [account, properties, loginHistory, activity, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        avatarUrl: true,
        createdAt: true,
        passwordHash: true,
      },
    }),
    prisma.property.findMany({
      where: { ownerId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.securityEvent.findMany({
      where: { userId: ownerId, action: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] } },
      select: { id: true, action: true, status: true, ipAddress: true, userAgent: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.securityEvent.findMany({
      where: { userId: ownerId },
      select: { id: true, action: true, target: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    listUserSessions(ownerId, currentToken),
  ]);
  if (!account) throw notFound();

  return {
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      phoneNumber: account.phoneNumber,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
      accountStatusAvailable: false,
      hasLocalPassword: account.passwordHash !== null,
    },
    preferences,
    properties,
    loginHistory,
    activity,
    sessions,
    notificationDeliveryAvailable: false,
  };
}

export async function updateOwnerPreferences(ownerId: string, input: OwnerPreferencesInput) {
  if (input.defaultPropertyId) {
    const property = await prisma.property.findFirst({
      where: { id: input.defaultPropertyId, ownerId },
      select: { id: true },
    });
    if (!property) throw new HttpError(400, 'Choose one of your own properties.');
  }
  return prisma.ownerPreferences.upsert({
    where: { ownerId },
    create: { ownerId, ...input },
    update: input,
    select: {
      defaultPropertyId: true,
      notifyNewInquiry: true,
      notifyNewReview: true,
      notifyListingStatus: true,
      notifyVerification: true,
      notifyPayment: true,
      notifyAnnouncements: true,
      emailNotifications: true,
      inAppNotifications: true,
    },
  });
}

export async function updateOwnerAvatar(ownerId: string, file: { buffer: Buffer; mimeType: string }) {
  return updateAccountAvatar(ownerId, file);
}

export async function removeOwnerAvatar(ownerId: string) {
  return removeAccountAvatar(ownerId);
}

export async function changeOwnerPassword(
  ownerId: string,
  input: OwnerPasswordChangeInput,
  currentToken: string,
  context: { ipAddress: string | null; userAgent: string | null },
) {
  return changeAccountPassword(ownerId, 'OWNER', input, currentToken, context);
}
