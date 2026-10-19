import { createHash, randomBytes } from 'node:crypto';
import {
  Availability,
  InquiryStatus,
  OwnerVerificationStatus,
  PropertyStatus,
  PropertyType,
  PrismaClient,
  ReportReason,
  ReportStatus,
  ReviewStatus,
  Role,
} from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const DEMO_PASSWORD = 'StayFinderDemo123';

const users = [
  { id: 'demo-owner-maria', name: 'Maria Santos', email: 'maria.owner@stayfinder.test', role: Role.OWNER },
  { id: 'demo-owner-jose', name: 'Jose Reyes', email: 'jose.owner@stayfinder.test', role: Role.OWNER },
  { id: 'demo-owner-ana', name: 'Ana Cruz', email: 'ana.owner@stayfinder.test', role: Role.OWNER },
  { id: 'demo-boarder-lia', name: 'Lia Dela Cruz', email: 'lia.boarder@stayfinder.test', role: Role.BOARDER },
  { id: 'demo-boarder-miguel', name: 'Miguel Ramos', email: 'miguel.boarder@stayfinder.test', role: Role.BOARDER },
  { id: 'demo-boarder-nina', name: 'Nina Garcia', email: 'nina.boarder@stayfinder.test', role: Role.BOARDER },
] as const;

const properties = [
  {
    id: 'demo-property-sablayan',
    ownerId: 'demo-owner-maria',
    name: 'Sablayan Seaside Boarding House',
    description: 'A bright, furnished boarding house close to the town center, public market, and transport.',
    propertyType: PropertyType.BOARDING_HOUSE,
    monthlyPrice: 4500,
    availability: Availability.AVAILABLE,
    availableRooms: 3,
    address: 'Market Road, Poblacion, Sablayan',
    location: 'Sablayan',
    latitude: 12.834,
    longitude: 120.769,
    status: PropertyStatus.APPROVED,
    amenities: ['wifi', 'electric-fan', 'shared-bathroom', 'shared-kitchen', 'laundry-area', 'secure-gate'],
  },
  {
    id: 'demo-property-san-jose-apartment',
    ownerId: 'demo-owner-jose',
    name: 'San Jose Garden Apartments',
    description: 'Quiet self-contained apartments with private bathrooms and a shared garden.',
    propertyType: PropertyType.APARTMENT,
    monthlyPrice: 8500,
    availability: Availability.AVAILABLE,
    availableRooms: 2,
    address: 'Rizal Street, Barangay 4, San Jose',
    location: 'San Jose',
    latitude: 12.352,
    longitude: 121.067,
    status: PropertyStatus.APPROVED,
    amenities: ['wifi', 'air-conditioning', 'own-bathroom', 'own-kitchen', 'parking', 'water-included'],
  },
  {
    id: 'demo-property-mamburao-bedspace',
    ownerId: 'demo-owner-ana',
    name: 'Mamburao Town Center Bedspace',
    description: 'Affordable shared accommodation within walking distance of shops and municipal offices.',
    propertyType: PropertyType.BEDSPACE,
    monthlyPrice: 2200,
    availability: Availability.AVAILABLE,
    availableRooms: 4,
    address: 'Bonifacio Street, Poblacion, Mamburao',
    location: 'Mamburao',
    latitude: 13.223,
    longitude: 120.596,
    status: PropertyStatus.APPROVED,
    amenities: ['electric-fan', 'shared-bathroom', 'shared-kitchen', 'lockers', 'secure-gate'],
  },
  {
    id: 'demo-property-lubang-room',
    ownerId: 'demo-owner-maria',
    name: 'Lubang Island Private Room',
    description: 'Furnished private room in a family home with reliable utilities and a study corner.',
    propertyType: PropertyType.ROOM,
    monthlyPrice: 3800,
    availability: Availability.COMING_SOON,
    availableRooms: 1,
    address: 'Tilik Road, Tilik, Lubang',
    location: 'Lubang',
    latitude: 13.858,
    longitude: 120.124,
    status: PropertyStatus.APPROVED,
    amenities: ['wifi', 'electric-fan', 'own-bathroom', 'study-area', 'furnished', 'water-included'],
  },
  {
    id: 'demo-property-calintaan',
    ownerId: 'demo-owner-jose',
    name: 'Calintaan Family Boarding Home',
    description: 'A practical, secure home with furnished rooms and parking for motorcycles.',
    propertyType: PropertyType.BOARDING_HOUSE,
    monthlyPrice: 3200,
    availability: Availability.AVAILABLE,
    availableRooms: 2,
    address: 'Poblacion Road, Calintaan',
    location: 'Calintaan',
    latitude: 12.573,
    longitude: 120.941,
    status: PropertyStatus.APPROVED,
    amenities: ['electric-fan', 'shared-bathroom', 'parking', 'laundry-area', 'furnished', 'secure-gate'],
  },
  {
    id: 'demo-property-santa-cruz-pending',
    ownerId: 'demo-owner-ana',
    name: 'Santa Cruz Riverside Rooms',
    description: 'Newly prepared rooms with a shared kitchen and space for bicycle storage.',
    propertyType: PropertyType.ROOM,
    monthlyPrice: 4000,
    availability: Availability.AVAILABLE,
    availableRooms: 2,
    address: 'Riverside Road, Santa Cruz',
    location: 'Santa Cruz',
    latitude: 13.476,
    longitude: 120.919,
    status: PropertyStatus.PENDING,
    amenities: ['wifi', 'electric-fan', 'shared-bathroom', 'shared-kitchen', 'study-area'],
  },
  {
    id: 'demo-property-rizal-full',
    ownerId: 'demo-owner-maria',
    name: 'Rizal Central Apartment',
    description: 'Compact apartment with a private kitchen and bathroom near local transport.',
    propertyType: PropertyType.APARTMENT,
    monthlyPrice: 7000,
    availability: Availability.FULLY_OCCUPIED,
    availableRooms: 0,
    address: 'National Highway, Poblacion, Rizal',
    location: 'Rizal',
    latitude: 12.466,
    longitude: 120.962,
    status: PropertyStatus.APPROVED,
    amenities: ['wifi', 'air-conditioning', 'own-bathroom', 'own-kitchen', 'parking'],
  },
  {
    id: 'demo-property-looc-pending',
    ownerId: 'demo-owner-jose',
    name: 'Looc Budget Bedspace',
    description: 'Simple shared bedspace with secure lockers and a covered laundry area.',
    propertyType: PropertyType.BEDSPACE,
    monthlyPrice: 2000,
    availability: Availability.AVAILABLE,
    availableRooms: 3,
    address: 'Looc Town Road, Looc',
    location: 'Looc',
    latitude: 13.723,
    longitude: 120.249,
    status: PropertyStatus.PENDING,
    amenities: ['electric-fan', 'shared-bathroom', 'lockers', 'laundry-area', 'secure-gate'],
  },
] as const;

async function seedUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) {
      if (existing.id !== user.id || existing.role !== user.role) {
        throw new Error(`Demo email ${user.email} already belongs to a different account; refusing to modify it.`);
      }
      continue;
    }

    await prisma.user.create({ data: { ...user, passwordHash } });
  }
}

async function seedProperties(prisma: PrismaClient): Promise<void> {
  for (const property of properties) {
    const { amenities, location, ownerId, ...fields } = property;
    await prisma.property.upsert({
      where: { id: property.id },
      update: {
        ...fields,
        owner: { connect: { id: ownerId } },
        location: { connect: { name: location } },
        amenities: { set: amenities.map((slug) => ({ slug })) },
      },
      create: {
        ...fields,
        owner: { connect: { id: ownerId } },
        location: { connect: { name: location } },
        amenities: { connect: amenities.map((slug) => ({ slug })) },
      },
    });

    await prisma.propertyImage.upsert({
      where: { id: `${property.id}-image` },
      update: {
        url: `https://placehold.co/1200x800?text=${encodeURIComponent(property.name)}`,
        isPrimary: true,
        sortOrder: 0,
      },
      create: {
        id: `${property.id}-image`,
        propertyId: property.id,
        url: `https://placehold.co/1200x800?text=${encodeURIComponent(property.name)}`,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    const roomCount = property.availableRooms > 0 ? Math.min(property.availableRooms, 2) : 1;
    for (let index = 0; index < roomCount; index += 1) {
      const roomId = `${property.id}-room-${index + 1}`;
      await prisma.room.upsert({
        where: { id: roomId },
        update: {
          name: `Room ${index + 1}`,
          monthlyPrice: property.monthlyPrice,
          capacity: property.propertyType === PropertyType.BEDSPACE ? 2 : 1,
          isAvailable: property.availability !== Availability.FULLY_OCCUPIED,
        },
        create: {
          id: roomId,
          propertyId: property.id,
          name: `Room ${index + 1}`,
          monthlyPrice: property.monthlyPrice,
          capacity: property.propertyType === PropertyType.BEDSPACE ? 2 : 1,
          isAvailable: property.availability !== Availability.FULLY_OCCUPIED,
        },
      });
    }
  }
}

async function seedBoarderActivity(prisma: PrismaClient): Promise<void> {
  const favorites = [
    ['demo-favorite-lia-sablayan', 'demo-boarder-lia', 'demo-property-sablayan'],
    ['demo-favorite-lia-san-jose', 'demo-boarder-lia', 'demo-property-san-jose-apartment'],
    ['demo-favorite-miguel-mamburao', 'demo-boarder-miguel', 'demo-property-mamburao-bedspace'],
    ['demo-favorite-miguel-calintaan', 'demo-boarder-miguel', 'demo-property-calintaan'],
    ['demo-favorite-nina-lubang', 'demo-boarder-nina', 'demo-property-lubang-room'],
  ] as const;
  for (const [id, boarderId, propertyId] of favorites) {
    await prisma.favorite.upsert({
      where: { boarderId_propertyId: { boarderId, propertyId } },
      update: {},
      create: { id, boarderId, propertyId },
    });
  }

  const inquiries = [
    {
      id: 'demo-inquiry-lia',
      senderId: 'demo-boarder-lia',
      ownerId: 'demo-owner-maria',
      propertyId: 'demo-property-sablayan',
      message: 'Is a room available for move-in next month, and are utilities included?',
      response: 'Yes, we have rooms available next month. Water is included; electricity is metered.',
      status: InquiryStatus.RESPONDED,
    },
    {
      id: 'demo-inquiry-miguel',
      senderId: 'demo-boarder-miguel',
      ownerId: 'demo-owner-jose',
      propertyId: 'demo-property-san-jose-apartment',
      message: 'Can I schedule a viewing this weekend?',
      response: null,
      status: InquiryStatus.PENDING,
    },
    {
      id: 'demo-inquiry-nina',
      senderId: 'demo-boarder-nina',
      ownerId: 'demo-owner-ana',
      propertyId: 'demo-property-mamburao-bedspace',
      message: 'Are the bedspaces furnished, and is there bicycle parking?',
      response: 'The bedspaces include a bed and locker. Bicycles can be kept inside the gated area.',
      status: InquiryStatus.RESPONDED,
    },
  ] as const;
  for (const inquiry of inquiries) {
    await prisma.inquiry.upsert({
      where: { id: inquiry.id },
      update: inquiry,
      create: inquiry,
    });
  }

  const reviews = [
    {
      id: 'demo-review-lia',
      boarderId: 'demo-boarder-lia',
      propertyId: 'demo-property-sablayan',
      rating: 5,
      content: 'Friendly owner, clean shared spaces, and a convenient location near town.',
      status: ReviewStatus.APPROVED,
    },
    {
      id: 'demo-review-miguel',
      boarderId: 'demo-boarder-miguel',
      propertyId: 'demo-property-calintaan',
      rating: 4,
      content: 'Good value and a quiet place to stay. The rooms are well maintained.',
      status: ReviewStatus.PENDING,
    },
    {
      id: 'demo-review-nina',
      boarderId: 'demo-boarder-nina',
      propertyId: 'demo-property-lubang-room',
      rating: 5,
      content: 'Comfortable furnished room with a useful study area.',
      status: ReviewStatus.APPROVED,
    },
  ] as const;
  for (const review of reviews) {
    await prisma.review.upsert({
      where: { id: review.id },
      update: review,
      create: review,
    });
  }

  const reports = [
    {
      id: 'demo-report-lia',
      boarderId: 'demo-boarder-lia',
      propertyId: 'demo-property-rizal-full',
      reason: ReportReason.PROPERTY_UNAVAILABLE,
      details: 'The listing may need its availability updated.',
      status: ReportStatus.PENDING,
    },
    {
      id: 'demo-report-miguel',
      boarderId: 'demo-boarder-miguel',
      propertyId: 'demo-property-calintaan',
      reason: ReportReason.INCORRECT_INFORMATION,
      details: 'Please confirm the listed parking arrangements with the owner.',
      status: ReportStatus.RESOLVED,
    },
  ] as const;
  for (const report of reports) {
    await prisma.report.upsert({
      where: { id: report.id },
      update: report,
      create: report,
    });
  }
}

async function seedOwnerVerifications(prisma: PrismaClient): Promise<void> {
  const verifications = [
    {
      ownerId: 'demo-owner-maria',
      legalName: 'Maria Lourdes Santos',
      phoneNumber: '+639171234501',
      documentType: 'Government ID',
      documentUrl: 'https://example.com/demo-documents/maria-id.jpg',
      additionalInfo: 'Sample approved verification record.',
      status: OwnerVerificationStatus.APPROVED,
      rejectionReason: null,
    },
    {
      ownerId: 'demo-owner-jose',
      legalName: 'Jose Manuel Reyes',
      phoneNumber: '+639171234502',
      documentType: 'Barangay Clearance',
      documentUrl: 'https://example.com/demo-documents/jose-clearance.jpg',
      additionalInfo: 'Sample verification awaiting review.',
      status: OwnerVerificationStatus.PENDING,
      rejectionReason: null,
    },
    {
      ownerId: 'demo-owner-ana',
      legalName: 'Ana Patricia Cruz',
      phoneNumber: '+639171234503',
      documentType: 'Government ID',
      documentUrl: 'https://example.com/demo-documents/ana-id.jpg',
      additionalInfo: 'Sample rejected record for dashboard testing.',
      status: OwnerVerificationStatus.REJECTED,
      rejectionReason: 'Please upload a clearer image of the document.',
    },
  ] as const;

  for (const verification of verifications) {
    await prisma.ownerVerification.upsert({
      where: { ownerId: verification.ownerId },
      update: verification,
      create: verification,
    });
  }
}

async function seedAuthRecords(prisma: PrismaClient): Promise<void> {
  const ownerId = 'demo-owner-maria';
  const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
  await prisma.session.upsert({
    where: { id: 'demo-session-maria' },
    update: { tokenHash, userId: ownerId, expiresAt: new Date('2099-12-31T23:59:59.000Z') },
    create: {
      id: 'demo-session-maria',
      tokenHash,
      userId: ownerId,
      expiresAt: new Date('2099-12-31T23:59:59.000Z'),
    },
  });

  await prisma.oAuthAccount.upsert({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: 'demo-google-maria' } },
    update: { userId: ownerId },
    create: {
      id: 'demo-oauth-maria',
      provider: 'google',
      providerAccountId: 'demo-google-maria',
      userId: ownerId,
    },
  });
}

async function seedSystemCheck(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.systemCheck.findFirst({ where: { note: 'demo-seed' } });
  if (!existing) await prisma.systemCheck.create({ data: { note: 'demo-seed' } });
}

export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  await seedUsers(prisma);
  await seedProperties(prisma);
  await seedBoarderActivity(prisma);
  await seedOwnerVerifications(prisma);
  await seedAuthRecords(prisma);
  await seedSystemCheck(prisma);
  console.log(`Demo data ready: ${users.length} users, ${properties.length} properties and related records.`);
  console.log(`Demo user password for all seeded users: ${DEMO_PASSWORD}`);
}
