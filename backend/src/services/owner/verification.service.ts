// Owner identity verification: view the current status and submit documents.
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/HttpError';
import type { OwnerVerificationInput } from '../../validators/owner.validators';

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
