// Owner reviews for the owner's own properties, with rating breakdown and trends.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface OwnerReviewQuery {
  page: number;
  propertyId?: string;
  rating?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  search?: string;
  sort: 'NEWEST' | 'OLDEST' | 'HIGHEST_RATING' | 'LOWEST_RATING';
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
