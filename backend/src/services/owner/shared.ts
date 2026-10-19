// Shared owner-service helpers. Only this file may hold the small building
// blocks used by several of the domain files (rooms, inquiries, payments, ...),
// so importing between domain files is never needed.
import { HttpError } from '../../lib/HttpError';
import { prisma } from '../../lib/prisma';

export const notFound = () => new HttpError(404, 'Resource not found.');

export async function findOwnedProperty(ownerId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId },
    select: { id: true },
  });
  if (!property) throw notFound();
  return property;
}
