import { Prisma } from '@prisma/client';
import {
  changeAccountPassword,
  removeAccountAvatar,
  updateAccountAvatar,
  updateAccountProfile,
} from './account.service';
import { HttpError } from '../lib/HttpError';
import { prisma } from '../lib/prisma';
import type {
  BoarderPreferencesInput,
  InquiryInput,
  ReportInput,
  ReviewInput,
} from '../validators/boarder.validators';
import type { OwnerPasswordChangeInput, OwnerProfileInput } from '../validators/owner.validators';
import { listUserSessions } from './session.service';

const approvedListing = (propertyId: string) =>
  prisma.property.findFirst({
    where: { id: propertyId, status: 'APPROVED' },
    select: { id: true, ownerId: true },
  });

const privateOrMissing = () => new HttpError(404, 'Approved property not found.');

export async function getBoarderSettings(boarderId: string, currentToken: string) {
  const [account, preferences, locations, amenities, loginHistory, activity, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: boarderId },
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
    prisma.boarderPreferences.upsert({
      where: { boarderId },
      create: { boarderId },
      update: {},
      include: { preferredAmenities: { select: { amenityId: true } } },
    }),
    prisma.location.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.amenity.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
    prisma.securityEvent.findMany({
      where: { userId: boarderId, action: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] } },
      select: { id: true, action: true, status: true, userAgent: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.securityEvent.findMany({
      where: { userId: boarderId },
      select: { id: true, action: true, target: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    listUserSessions(boarderId, currentToken),
  ]);
  if (!account) throw new HttpError(404, 'Account not found.');

  const { preferredAmenities, ...savedPreferences } = preferences;
  return {
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      phoneNumber: account.phoneNumber,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
      hasLocalPassword: account.passwordHash !== null,
    },
    preferences: {
      ...savedPreferences,
      preferredAmenityIds: preferredAmenities.map(({ amenityId }) => amenityId),
    },
    locations,
    amenities,
    loginHistory,
    activity,
    sessions,
    notificationDeliveryAvailable: false,
    privacyControlsAvailable: false,
    themeSwitchingAvailable: false,
    accountActionsAvailable: false,
  };
}

export async function updateBoarderPreferences(boarderId: string, input: BoarderPreferencesInput) {
  if (input.preferredLocationId) {
    const location = await prisma.location.findUnique({
      where: { id: input.preferredLocationId },
      select: { id: true },
    });
    if (!location) throw new HttpError(400, 'Choose a supported municipality.');
  }
  const amenityIds = [...new Set(input.preferredAmenityIds)];
  if (amenityIds.length !== input.preferredAmenityIds.length) {
    throw new HttpError(400, 'Choose each amenity only once.');
  }
  if (amenityIds.length) {
    const count = await prisma.amenity.count({ where: { id: { in: amenityIds } } });
    if (count !== amenityIds.length) throw new HttpError(400, 'Choose amenities from the supported list.');
  }

  const { preferredAmenityIds, ...data } = input;
  await prisma.$transaction(async (transaction) => {
    const preferences = await transaction.boarderPreferences.upsert({
      where: { boarderId },
      create: { boarderId, ...data },
      update: data,
      select: { id: true },
    });
    await transaction.boarderPreferenceAmenity.deleteMany({
      where: { boarderPreferencesId: preferences.id },
    });
    if (preferredAmenityIds.length) {
      await transaction.boarderPreferenceAmenity.createMany({
        data: preferredAmenityIds.map((amenityId) => ({
          boarderPreferencesId: preferences.id,
          amenityId,
        })),
      });
    }
  });

  const result = await prisma.boarderPreferences.findUniqueOrThrow({
    where: { boarderId },
    include: { preferredAmenities: { select: { amenityId: true } } },
  });
  const { preferredAmenities, ...savedPreferences } = result;
  return {
    ...savedPreferences,
    preferredAmenityIds: preferredAmenities.map(({ amenityId }) => amenityId),
  };
}

export function updateBoarderProfile(boarderId: string, input: OwnerProfileInput) {
  return updateAccountProfile(boarderId, input);
}

export function updateBoarderAvatar(boarderId: string, file: { buffer: Buffer; mimeType: string }) {
  return updateAccountAvatar(boarderId, file);
}

export function removeBoarderAvatar(boarderId: string) {
  return removeAccountAvatar(boarderId);
}

export function changeBoarderPassword(
  boarderId: string,
  input: OwnerPasswordChangeInput,
  currentToken: string,
  context: { ipAddress: string | null; userAgent: string | null },
) {
  return changeAccountPassword(boarderId, 'BOARDER', input, currentToken, context);
}

export async function listBoarderFavorites(boarderId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { boarderId, property: { status: 'APPROVED' } },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          propertyType: true,
          monthlyPrice: true,
          availability: true,
          availableRooms: true,
          address: true,
          location: { select: { name: true } },
          images: {
            select: { id: true, url: true, isPrimary: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return favorites.map(({ id, createdAt, property }) => {
    const { location, ...publicProperty } = property;
    return { id, createdAt, property: { ...publicProperty, municipality: location.name } };
  });
}

export async function addBoarderFavorite(boarderId: string, propertyId: string) {
  const property = await approvedListing(propertyId);
  if (!property) throw privateOrMissing();

  return prisma.favorite.upsert({
    where: { boarderId_propertyId: { boarderId, propertyId } },
    create: { boarderId, propertyId },
    update: {},
    select: { id: true, createdAt: true, propertyId: true },
  });
}

export async function removeBoarderFavorite(boarderId: string, propertyId: string) {
  await prisma.favorite.deleteMany({ where: { boarderId, propertyId } });
}

export async function listBoarderInquiries(boarderId: string) {
  return prisma.inquiry.findMany({
    where: { senderId: boarderId },
    select: {
      id: true,
      message: true,
      response: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      property: {
        select: {
          id: true,
          name: true,
          status: true,
          location: { select: { name: true } },
        },
      },
      owner: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBoarderInquiry(boarderId: string, input: InquiryInput) {
  const property = await approvedListing(input.propertyId);
  if (!property) throw privateOrMissing();

  return prisma.inquiry.create({
    data: {
      senderId: boarderId,
      ownerId: property.ownerId,
      propertyId: property.id,
      message: input.message,
    },
    select: {
      id: true,
      message: true,
      status: true,
      createdAt: true,
      property: { select: { id: true, name: true } },
      owner: { select: { name: true } },
    },
  });
}

export async function listBoarderReviews(boarderId: string) {
  return prisma.review.findMany({
    where: { boarderId },
    select: {
      id: true,
      rating: true,
      content: true,
      status: true,
      createdAt: true,
      property: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBoarderReview(
  boarderId: string,
  propertyId: string,
  input: ReviewInput,
) {
  if (!(await approvedListing(propertyId))) throw privateOrMissing();

  try {
    return await prisma.review.create({
      data: { boarderId, propertyId, ...input },
      select: { id: true, rating: true, content: true, status: true, createdAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'You have already reviewed this property.');
    }
    throw error;
  }
}

export async function listBoarderReports(boarderId: string) {
  return prisma.report.findMany({
    where: { boarderId },
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      property: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBoarderReport(
  boarderId: string,
  propertyId: string,
  input: ReportInput,
) {
  if (!(await approvedListing(propertyId))) throw privateOrMissing();
  return prisma.report.create({
    data: {
      boarderId,
      propertyId,
      reason: input.reason,
      details: input.details || null,
    },
    select: { id: true, reason: true, details: true, status: true, createdAt: true },
  });
}
