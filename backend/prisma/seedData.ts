import type { PrismaClient } from '@prisma/client';

// Reference data every environment needs. Safe to run many times (upserts).
export const MUNICIPALITIES = [
  'Abra de Ilog',
  'Calintaan',
  'Looc',
  'Lubang',
  'Magsaysay',
  'Mamburao',
  'Paluan',
  'Rizal',
  'Sablayan',
  'San Jose',
  'Santa Cruz',
];

export const AMENITIES = [
  { slug: 'wifi', name: 'Wi-Fi' },
  { slug: 'electric-fan', name: 'Electric fan' },
  { slug: 'air-conditioning', name: 'Air conditioning' },
  { slug: 'own-bathroom', name: 'Own bathroom' },
  { slug: 'shared-bathroom', name: 'Shared bathroom' },
  { slug: 'own-kitchen', name: 'Own kitchen' },
  { slug: 'shared-kitchen', name: 'Shared kitchen' },
  { slug: 'parking', name: 'Parking' },
  { slug: 'laundry-area', name: 'Laundry area' },
  { slug: 'study-area', name: 'Study area' },
  { slug: 'water-included', name: 'Water included' },
  { slug: 'electricity-included', name: 'Electricity included' },
  { slug: 'secure-gate', name: 'Secure gate' },
  { slug: 'cctv', name: 'CCTV' },
  { slug: 'furnished', name: 'Furnished' },
  { slug: 'lockers', name: 'Lockers' },
];

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  for (const name of MUNICIPALITIES) {
    await prisma.location.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const amenity of AMENITIES) {
    await prisma.amenity.upsert({
      where: { slug: amenity.slug },
      update: { name: amenity.name },
      create: amenity,
    });
  }
}
