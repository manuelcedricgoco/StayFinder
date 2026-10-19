// Owner inquiries received from boarders, with reply/close handling.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/HttpError';
import type { OwnerInquiryReplyInput } from '../../validators/owner.validators';
import { notFound } from './shared';

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
