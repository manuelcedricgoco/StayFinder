// Owner dashboard statistics and per-property performance aggregates.
import { prisma } from '../../lib/prisma';

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
