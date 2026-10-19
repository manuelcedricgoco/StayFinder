// Room management for the owner dashboard. Availability syncing keeps the
// property-level counters in step with the individually tracked rooms.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { RoomInput } from '../../validators/owner.validators';
import { findOwnedProperty, notFound } from './shared';

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
