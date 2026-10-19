// Owner payment ledger: recorded rent payments, summaries, CSV export.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/HttpError';
import type { PaymentRecordInput } from '../../validators/payment.validators';
import { notFound } from './shared';

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
