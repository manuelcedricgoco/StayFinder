import { Prisma } from '@prisma/client';
import { changeAccountPassword, removeAccountAvatar, updateAccountAvatar, updateAccountProfile } from './account.service';
import { HttpError } from '../lib/HttpError';
import { prisma } from '../lib/prisma';
import { listUserSessions } from './session.service';
import type {
  OwnerPasswordChangeInput,
  OwnerPreferencesInput,
} from '../validators/owner.validators';
import type {
  OwnerInquiryReplyInput,
  OwnerProfileInput,
  OwnerVerificationInput,
  RoomInput,
} from '../validators/owner.validators';
import type { PaymentRecordInput } from '../validators/payment.validators';

const notFound = () => new HttpError(404, 'Resource not found.');

export async function getOwnerDashboardStats(ownerId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [properties, inquiryCount, newInquiryCount, rating, monthlyInquiries, recentInquiries, recentReviews, verification] = await Promise.all([
    prisma.property.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        availableRooms: true,
        location: { select: { name: true } },
        rooms: { select: { id: true, isAvailable: true } },
      },
    }),
    prisma.inquiry.count({ where: { ownerId } }),
    prisma.inquiry.count({ where: { ownerId, status: 'PENDING' } }),
    prisma.review.aggregate({
      where: { property: { ownerId }, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.inquiry.groupBy({
      by: ['propertyId'],
      where: { ownerId, createdAt: { gte: startOfMonth } },
      _count: { _all: true },
    }),
    prisma.inquiry.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        message: true,
        status: true,
        createdAt: true,
        sender: { select: { name: true } },
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.review.findMany({
      where: { property: { ownerId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        rating: true,
        content: true,
        status: true,
        createdAt: true,
        boarder: { select: { name: true } },
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.ownerVerification.findUnique({
      where: { ownerId },
      select: { status: true },
    }),
  ]);

  const monthlyInquiryCounts = new Map(monthlyInquiries.map((inquiry) => [inquiry.propertyId, inquiry._count._all]));
  const propertyRatings = await prisma.review.groupBy({
    by: ['propertyId'],
    where: { property: { ownerId }, status: 'APPROVED' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratingsByProperty = new Map(propertyRatings.map((ratingByProperty) => [
    ratingByProperty.propertyId,
    { averageRating: ratingByProperty._avg.rating, reviewCount: ratingByProperty._count._all },
  ]));
  const propertyPerformance = properties.map((property) => {
    const roomsTracked = property.rooms.length > 0;
    const availableRooms = roomsTracked
      ? property.rooms.filter((room) => room.isAvailable).length
      : property.availableRooms;
    const ratings = ratingsByProperty.get(property.id);
    return {
      id: property.id,
      name: property.name,
      location: property.location.name,
      totalRooms: roomsTracked ? property.rooms.length : null,
      availableRooms,
      occupiedRooms: roomsTracked ? property.rooms.filter((room) => !room.isAvailable).length : null,
      roomAvailabilityTracked: roomsTracked,
      monthlyInquiries: monthlyInquiryCounts.get(property.id) ?? 0,
      averageRating: ratings?.averageRating ?? null,
      reviewCount: ratings?.reviewCount ?? 0,
      status: property.status,
    };
  });

  const trackedRooms = properties.flatMap((property) => property.rooms);
  const availableTrackedRooms = trackedRooms.filter((room) => room.isAvailable).length;
  const occupiedTrackedRooms = trackedRooms.length - availableTrackedRooms;
  const legacyAvailableRooms = properties
    .filter((property) => property.rooms.length === 0)
    .reduce((total, property) => total + property.availableRooms, 0);
  const verificationStatus = verification?.status ?? 'NOT_VERIFIED';

  return {
    totalProperties: properties.length,
    approvedProperties: properties.filter((property) => property.status === 'APPROVED').length,
    pendingProperties: properties.filter((property) => property.status === 'PENDING').length,
    availableRooms: availableTrackedRooms + legacyAvailableRooms,
    occupiedRooms: occupiedTrackedRooms,
    trackedRoomCount: trackedRooms.length,
    availableTrackedRooms,
    occupiedTrackedRooms,
    newInquiries: newInquiryCount,
    totalInquiries: inquiryCount,
    averageRating: rating._avg.rating,
    publishedReviewCount: rating._count.rating,
    verificationStatus,
    profileStatus: verificationStatus,
    propertyPerformance,
    recentInquiries,
    recentReviews,
    earnings: { available: false },
    bookings: { available: false },
  };
}

async function findOwnedProperty(ownerId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId },
    select: { id: true },
  });
  if (!property) throw notFound();
  return property;
}

async function syncManagedRoomAvailability(
  transaction: Prisma.TransactionClient,
  propertyId: string,
) {
  const rooms = await transaction.room.findMany({
    where: { propertyId },
    select: { isAvailable: true },
  });
  if (!rooms.length) return;
  const availableRooms = rooms.filter((room) => room.isAvailable).length;
  await transaction.property.update({
    where: { id: propertyId },
    data: {
      availableRooms,
      availability: availableRooms > 0 ? 'AVAILABLE' : 'FULLY_OCCUPIED',
    },
  });
}

export async function listOwnerRooms(ownerId: string, propertyId: string) {
  await findOwnedProperty(ownerId, propertyId);
  return prisma.room.findMany({
    where: { propertyId },
    orderBy: { name: 'asc' },
  });
}

export async function createOwnerRoom(ownerId: string, propertyId: string, input: RoomInput) {
  await findOwnedProperty(ownerId, propertyId);
  return prisma.$transaction(async (transaction) => {
    const room = await transaction.room.create({ data: { ...input, propertyId } });
    await syncManagedRoomAvailability(transaction, propertyId);
    return room;
  });
}

export async function updateOwnerRoom(ownerId: string, roomId: string, input: RoomInput) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, property: { ownerId } },
    select: { id: true },
  });
  if (!room) throw notFound();
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.room.update({ where: { id: room.id }, data: input });
    await syncManagedRoomAvailability(transaction, updated.propertyId);
    return updated;
  });
}

export async function deleteOwnerRoom(ownerId: string, roomId: string) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, property: { ownerId } },
    select: { id: true, propertyId: true },
  });
  if (!room) throw notFound();
  await prisma.$transaction(async (transaction) => {
    await transaction.room.delete({ where: { id: room.id } });
    await syncManagedRoomAvailability(transaction, room.propertyId);
  });
}

export interface OwnerInquiryQuery {
  page: number;
  propertyId?: string;
  status?: 'PENDING' | 'RESPONDED' | 'CLOSED';
  search?: string;
  sort: 'NEWEST' | 'OLDEST' | 'UPDATED';
}

export async function listOwnerInquiries(ownerId: string, query: OwnerInquiryQuery) {
  const pageSize = 10;
  const where: Prisma.InquiryWhereInput = {
    ownerId,
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? {
      OR: [
        { message: { contains: query.search } },
        { response: { contains: query.search } },
        { sender: { name: { contains: query.search } } },
        { property: { name: { contains: query.search } } },
      ],
    } : {}),
  };

  const [inquiries, total, statusCounts, properties] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      select: {
        id: true,
        message: true,
        response: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        sender: { select: { id: true, name: true } },
        property: {
          select: {
            id: true,
            name: true,
            monthlyPrice: true,
            availability: true,
            availableRooms: true,
            location: { select: { name: true } },
          },
        },
      },
      orderBy: query.sort === 'OLDEST'
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : query.sort === 'UPDATED'
          ? [{ updatedAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inquiry.count({ where }),
    prisma.inquiry.groupBy({
      by: ['status'],
      where: { ownerId },
      _count: { _all: true },
    }),
    prisma.property.findMany({
      where: { ownerId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  const count = (status: 'PENDING' | 'RESPONDED' | 'CLOSED') =>
    statusCounts.find((item) => item.status === status)?._count._all ?? 0;

  return {
    inquiries,
    properties,
    summary: {
      total: statusCounts.reduce((sum, item) => sum + item._count._all, 0),
      waiting: count('PENDING'),
      responded: count('RESPONDED'),
      closed: count('CLOSED'),
    },
    pagination: {
      page: query.page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function respondToOwnerInquiry(
  ownerId: string,
  inquiryId: string,
  input: OwnerInquiryReplyInput,
) {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, ownerId },
    select: { id: true, status: true },
  });
  if (!inquiry) throw notFound();
  if (inquiry.status === 'CLOSED' && input.status !== 'RESPONDED' && input.status !== 'PENDING') {
    throw new HttpError(409, 'This inquiry is already closed.');
  }

  const status = input.status ?? (input.response ? 'RESPONDED' : inquiry.status);
  return prisma.inquiry.update({
    where: { id: inquiry.id },
    data: {
      ...(input.response !== undefined ? { response: input.response } : {}),
      status,
    },
    select: {
      id: true,
      message: true,
      response: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      sender: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
    },
  });
}

export interface OwnerReviewQuery {
  page: number;
  propertyId?: string;
  rating?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  search?: string;
  sort: 'NEWEST' | 'OLDEST' | 'HIGHEST_RATING' | 'LOWEST_RATING';
}

export type OwnerPaymentMethod = 'CASH' | 'GCASH' | 'MAYA' | 'BANK_TRANSFER' | 'OTHER';

export interface OwnerPaymentQuery {
  page: number;
  propertyId?: string;
  paymentMethod?: OwnerPaymentMethod;
  search?: string;
  from?: Date;
  to?: Date;
}

const paymentSelect = {
  id: true,
  boarderName: true,
  amount: true,
  paymentDate: true,
  paymentMethod: true,
  status: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  property: {
    select: {
      id: true,
      name: true,
      monthlyPrice: true,
      location: { select: { name: true } },
    },
  },
  room: { select: { id: true, name: true } },
} satisfies Prisma.PaymentRecordSelect;

function ownerPaymentWhere(ownerId: string, query: OwnerPaymentQuery): Prisma.PaymentRecordWhereInput {
  return {
    property: { ownerId },
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.search ? {
      OR: [
        { boarderName: { contains: query.search } },
        { referenceNumber: { contains: query.search } },
        { property: { name: { contains: query.search } } },
      ],
    } : {}),
    ...(query.from || query.to ? {
      paymentDate: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      },
    } : {}),
  };
}

export async function listOwnerPaymentRecords(ownerId: string, query: OwnerPaymentQuery) {
  const pageSize = 10;
  const where = ownerPaymentWhere(ownerId, query);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [records, total, overall, currentMonth, properties, monthlyTotals, propertyTotals] = await Promise.all([
    prisma.paymentRecord.findMany({
      where,
      select: paymentSelect,
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentRecord.count({ where }),
    prisma.paymentRecord.aggregate({
      where: { property: { ownerId }, status: 'PAID' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.paymentRecord.aggregate({
      where: { property: { ownerId }, status: 'PAID', paymentDate: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.property.findMany({
      where: { ownerId },
      select: {
        id: true,
        name: true,
        monthlyPrice: true,
        availability: true,
        availableRooms: true,
        location: { select: { name: true } },
        rooms: { select: { id: true, name: true, monthlyPrice: true, isAvailable: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.paymentRecord.groupBy({
      by: ['paymentDate'],
      where: { property: { ownerId }, status: 'PAID', paymentDate: { gte: sixMonthsAgo } },
      _sum: { amount: true },
    }),
    prisma.paymentRecord.groupBy({
      by: ['propertyId'],
      where: { property: { ownerId }, status: 'PAID' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const monthSums = new Map<string, number>();
  for (const item of monthlyTotals) {
    const month = `${item.paymentDate.getFullYear()}-${String(item.paymentDate.getMonth() + 1).padStart(2, '0')}`;
    monthSums.set(month, (monthSums.get(month) ?? 0) + (item._sum.amount ?? 0));
  }
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      month: date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }),
      amount: monthSums.get(key) ?? 0,
    };
  });
  const propertySums = new Map(propertyTotals.map((item) => [
    item.propertyId,
    { amount: item._sum.amount ?? 0, count: item._count._all },
  ]));

  return {
    records,
    properties: properties.map((property) => ({
      ...property,
      totalCollected: propertySums.get(property.id)?.amount ?? 0,
      paymentCount: propertySums.get(property.id)?.count ?? 0,
    })),
    summary: {
      totalCollected: overall._sum.amount ?? 0,
      thisMonth: currentMonth._sum.amount ?? 0,
      pendingCount: null,
      completedCount: overall._count._all,
    },
    monthlyEarnings: months,
    hasMonthlyHistory: monthSums.size >= 2,
    pagination: { page: query.page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getOwnerPaymentRecord(ownerId: string, paymentId: string) {
  const record = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, property: { ownerId } },
    select: paymentSelect,
  });
  if (!record) throw notFound();
  return record;
}

export async function createOwnerPaymentRecord(
  ownerId: string,
  input: PaymentRecordInput,
  actor: { userId: string; userName: string; email: string; ipAddress: string | null; userAgent: string | null },
) {
  return prisma.$transaction(async (transaction) => {
    const property = await transaction.property.findFirst({
      where: { id: input.propertyId, ownerId },
      select: { id: true, name: true },
    });
    if (!property) throw new HttpError(404, 'Property not found.');

    if (input.roomId) {
      const room = await transaction.room.findFirst({
        where: { id: input.roomId, propertyId: property.id },
        select: { id: true },
      });
      if (!room) throw new HttpError(400, 'Choose a room belonging to this property.');
    }

    const record = await transaction.paymentRecord.create({
      data: {
        propertyId: property.id,
        roomId: input.roomId ?? null,
        boarderName: input.boarderName,
        amount: input.amount,
        paymentDate: new Date(input.paymentDate),
        paymentMethod: input.paymentMethod,
        status: 'PAID',
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null,
      },
      select: paymentSelect,
    });

    await transaction.securityEvent.create({
      data: {
        userId: actor.userId,
        userName: actor.userName,
        email: actor.email,
        role: 'OWNER',
        action: 'PAYMENT_RECORDED',
        target: `${property.name} (${record.id})`,
        status: 'SUCCESS',
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
    return record;
  });
}

function csvCell(value: string | number | Date | null) {
  const text = value instanceof Date ? value.toISOString() : value === null ? '' : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export async function exportOwnerPaymentRecords(ownerId: string, query: OwnerPaymentQuery) {
  const records = await prisma.paymentRecord.findMany({
    where: ownerPaymentWhere(ownerId, query),
    select: paymentSelect,
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    take: 10_000,
  });
  const rows = [
    ['Transaction ID', 'Payment Date', 'Boarder', 'Property', 'Room', 'Amount', 'Payment Method', 'Status', 'Reference Number', 'Notes'],
    ...records.map((record) => [
      record.id,
      record.paymentDate,
      record.boarderName,
      record.property.name,
      record.room?.name ?? '',
      record.amount,
      record.paymentMethod,
      record.status,
      record.referenceNumber,
      record.notes,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export async function listOwnerReviews(ownerId: string, query: OwnerReviewQuery) {
  const pageSize = 10;
  const reviewWhere: Prisma.ReviewWhereInput = {
    property: { ownerId },
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.rating ? { rating: query.rating } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? {
      OR: [
        { content: { contains: query.search } },
        { boarder: { name: { contains: query.search } } },
        { property: { name: { contains: query.search } } },
      ],
    } : {}),
  };
  const approvedWhere: Prisma.ReviewWhereInput = {
    property: { ownerId },
    status: 'APPROVED',
  };
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [reviews, total, statusCounts, ratingCounts, propertyRecords, monthlyReviews, previousMonthReviews] = await Promise.all([
    prisma.review.findMany({
      where: reviewWhere,
      select: {
        id: true,
        rating: true,
        content: true,
        status: true,
        createdAt: true,
        property: { select: { id: true, name: true } },
        boarder: { select: { name: true } },
      },
      orderBy: query.sort === 'OLDEST'
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : query.sort === 'HIGHEST_RATING'
          ? [{ rating: 'desc' }, { createdAt: 'desc' }]
          : query.sort === 'LOWEST_RATING'
            ? [{ rating: 'asc' }, { createdAt: 'desc' }]
            : [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where: reviewWhere }),
    prisma.review.groupBy({
      by: ['status'],
      where: { property: { ownerId } },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ['rating'],
      where: approvedWhere,
      _count: { _all: true },
    }),
    prisma.property.findMany({
      where: { ownerId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.review.aggregate({
      where: { ...approvedWhere, createdAt: { gte: startOfMonth } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.aggregate({
      where: {
        ...approvedWhere,
        createdAt: { gte: startOfPreviousMonth, lt: startOfMonth },
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const allCount = statusCounts.reduce((sum, item) => sum + item._count._all, 0);
  const approvedCount = statusCounts.find((item) => item.status === 'APPROVED')?._count._all ?? 0;
  const ratingCountByValue = new Map(ratingCounts.map((item) => [item.rating, item._count._all]));
  const propertyRatings = await prisma.review.groupBy({
    by: ['propertyId'],
    where: approvedWhere,
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratingByPropertyId = new Map(propertyRatings.map((item) => [item.propertyId, item]));
  const properties = propertyRecords.map((property) => {
    const rating = ratingByPropertyId.get(property.id);
    return {
      ...property,
      reviewCount: rating?._count._all ?? 0,
      averageRating: rating?._avg.rating ?? null,
    };
  });
  const mostCommonRating = ratingCounts
    .slice()
    .sort((a, b) => b._count._all - a._count._all || b.rating - a.rating)[0]?.rating ?? null;
  const monthlyAverage = monthlyReviews._avg.rating;
  const previousMonthAverage = previousMonthReviews._avg.rating;

  return {
    reviews,
    properties,
    summary: {
      total: allCount,
      approved: approvedCount,
      pending: statusCounts.find((item) => item.status === 'PENDING')?._count._all ?? 0,
      rejected: statusCounts.find((item) => item.status === 'REJECTED')?._count._all ?? 0,
      averageRating: approvedCount
        ? ratingCounts.reduce((sum, item) => sum + item.rating * item._count._all, 0) / approvedCount
        : null,
      ratingBreakdown: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: ratingCountByValue.get(rating) ?? 0,
      })),
      mostCommonRating,
      reviewsThisMonth: monthlyReviews._count._all,
      ratingTrend: monthlyReviews._count._all > 0 && previousMonthReviews._count._all > 0
        ? monthlyAverage! - previousMonthAverage!
        : null,
    },
    pagination: {
      page: query.page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

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

export async function getOwnerVerification(ownerId: string) {
  return prisma.ownerVerification.findUnique({
    where: { ownerId },
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
    },
  });
}

export async function submitOwnerVerification(ownerId: string, input: OwnerVerificationInput) {
  const existing = await prisma.ownerVerification.findUnique({ where: { ownerId } });
  if (existing?.status === 'APPROVED') {
    throw new HttpError(409, 'Your owner verification is already approved.');
  }
  if (existing?.status === 'PENDING') {
    throw new HttpError(409, 'Your owner verification is still pending review.');
  }

  return prisma.ownerVerification.upsert({
    where: { ownerId },
    create: { ownerId, ...input, status: 'PENDING' },
    update: {
      ...input,
      status: 'PENDING',
      rejectionReason: null,
      submittedAt: new Date(),
    },
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
    },
  });
}
