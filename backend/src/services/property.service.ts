import { Prisma, type PropertyStatus } from '@prisma/client';
import { HttpError } from '../lib/HttpError';
import { prisma } from '../lib/prisma';
import { removeStoredPropertyImage, savePropertyImage, MAX_PROPERTY_IMAGES } from '../lib/propertyImageStorage';
import { getPlatformSettings } from './platformSettings.service';
import type { PropertyInput, PublicPropertySearchInput } from '../validators/property.validators';

const propertyInclude = {
  location: { select: { name: true } },
  amenities: { select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } },
  images: {
    select: { id: true, url: true, isPrimary: true, sortOrder: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
  },
} satisfies Prisma.PropertyInclude;

const adminPropertyInclude = {
  ...propertyInclude,
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PropertyInclude;

const publicPropertyDetailInclude = {
  ...propertyInclude,
  rooms: {
    select: { id: true, name: true, monthlyPrice: true, capacity: true, isAvailable: true },
    orderBy: { name: 'asc' },
  },
  reviews: {
    where: { status: 'APPROVED' },
    select: { id: true, rating: true, content: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  },
  owner: {
    select: {
      name: true,
      ownerVerification: { select: { status: true } },
    },
  },
} satisfies Prisma.PropertyInclude;

type PropertyRecord = Prisma.PropertyGetPayload<{ include: typeof propertyInclude }>;
type AdminPropertyRecord = Prisma.PropertyGetPayload<{ include: typeof adminPropertyInclude }>;
type PublicPropertyDetailRecord = Prisma.PropertyGetPayload<{ include: typeof publicPropertyDetailInclude }>;

// Explicit shape sent to clients.
export function toPropertyDTO(p: PropertyRecord) {
  return {
    id: p.id,
    ownerId: p.ownerId,
    name: p.name,
    description: p.description,
    propertyType: p.propertyType,
    monthlyPrice: p.monthlyPrice,
    availability: p.availability,
    availableRooms: p.availableRooms,
    address: p.address,
    municipality: p.location.name,
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.status,
    rejectionReason: p.rejectionReason,
    amenities: p.amenities,
    images: p.images,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toAdminPropertyDTO(p: AdminPropertyRecord) {
  return { ...toPropertyDTO(p), owner: p.owner };
}

const notFound = () => new HttpError(404, 'Property not found.');

// Turns the municipality name and amenity slugs from the form into database ids.
async function resolveReferences(input: Pick<PropertyInput, 'municipality' | 'amenities'>) {
  const location = await prisma.location.findUnique({ where: { name: input.municipality } });
  if (!location) {
    throw new HttpError(400, 'Please fix the highlighted fields.', [
      { field: 'municipality', message: 'Choose a municipality in Occidental Mindoro.' },
    ]);
  }

  const amenities = await prisma.amenity.findMany({
    where: { slug: { in: input.amenities } },
    select: { id: true },
  });
  if (amenities.length !== input.amenities.length) {
    throw new HttpError(400, 'Please fix the highlighted fields.', [
      { field: 'amenities', message: 'One or more selected amenities do not exist.' },
    ]);
  }

  return { locationId: location.id, amenityIds: amenities.map((a) => ({ id: a.id })) };
}

function scalarFields(input: PropertyInput, locationId: string) {
  return {
    name: input.name,
    description: input.description,
    propertyType: input.propertyType,
    monthlyPrice: input.monthlyPrice,
    availability: input.availability,
    // A fully occupied listing has no rooms available, whatever number was typed.
    availableRooms: input.availability === 'FULLY_OCCUPIED' ? 0 : input.availableRooms,
    address: input.address,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    locationId,
  };
}

// Keep support for existing clients that still provide https image URLs.
function imageRows(urls: string[]) {
  return urls.map((url, index) => ({ url, isPrimary: index === 0, sortOrder: index }));
}

// ---------------------------------------------------------------------------
// Owner operations. Every query is scoped by ownerId, so one owner can never
// read or change another owner's property (they get 404, not 403).
// ---------------------------------------------------------------------------

export async function listOwnerProperties(ownerId: string, status?: PropertyStatus) {
  const where = { ownerId, ...(status ? { status } : {}) };
  const [properties, monthlyInquiries, ratings] = await Promise.all([
    prisma.property.findMany({
      where,
      include: {
        ...propertyInclude,
        rooms: { select: { id: true, isAvailable: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inquiry.groupBy({
      by: ['propertyId'],
      where: { ownerId, ...(status ? { property: { status } } : {}), createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ['propertyId'],
      where: { property: { ownerId, ...(status ? { status } : {}) }, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
  const inquiriesByProperty = new Map(monthlyInquiries.map((inquiry) => [inquiry.propertyId, inquiry._count._all]));
  const ratingsByProperty = new Map(ratings.map((rating) => [
    rating.propertyId,
    { averageRating: rating._avg.rating, reviewCount: rating._count._all },
  ]));
  return properties.map((property) => ({
    ...toPropertyDTO(property),
    rooms: property.rooms,
    monthlyInquiries: inquiriesByProperty.get(property.id) ?? 0,
    averageRating: ratingsByProperty.get(property.id)?.averageRating ?? null,
    approvedReviewCount: ratingsByProperty.get(property.id)?.reviewCount ?? 0,
  }));
}

export async function searchPublicProperties(query: PublicPropertySearchInput) {
  const amenitySlugs = query.amenities ? [...new Set(query.amenities.split(','))] : [];
  const where: Prisma.PropertyWhereInput = {
    status: 'APPROVED',
    ...(query.q ? { name: { contains: query.q } } : {}),
    ...(query.municipality ? { location: { name: query.municipality } } : {}),
    ...(query.propertyType ? { propertyType: query.propertyType } : {}),
    ...(query.availability ? { availability: query.availability } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          monthlyPrice: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
          },
        }
      : {}),
    ...(amenitySlugs.length
      ? { AND: amenitySlugs.map((slug) => ({ amenities: { some: { slug } } })) }
      : {}),
  };
  const take = 12;
  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    query.sort === 'PRICE_ASC'
      ? { monthlyPrice: 'asc' }
      : query.sort === 'PRICE_DESC'
        ? { monthlyPrice: 'desc' }
        : { createdAt: 'desc' };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: propertyInclude,
      orderBy: [orderBy, { id: 'asc' }],
      skip: (query.page - 1) * take,
      take,
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties: properties.map((property) => {
      const dto = toPropertyDTO(property);
      return {
        id: dto.id,
        name: dto.name,
        description: dto.description,
        propertyType: dto.propertyType,
        monthlyPrice: dto.monthlyPrice,
        availability: dto.availability,
        availableRooms: dto.availableRooms,
        address: dto.address,
        municipality: dto.municipality,
        latitude: dto.latitude,
        longitude: dto.longitude,
        amenities: dto.amenities,
        images: dto.images,
      };
    }),
    pagination: {
      page: query.page,
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getPublicProperty(id: string) {
  const property = await prisma.property.findFirst({
    where: { id, status: 'APPROVED' },
    include: publicPropertyDetailInclude,
  });
  if (!property) throw notFound();

  return {
    id: property.id,
    name: property.name,
    description: property.description,
    propertyType: property.propertyType,
    monthlyPrice: property.monthlyPrice,
    availability: property.availability,
    availableRooms: property.availableRooms,
    address: property.address,
    municipality: property.location.name,
    latitude: property.latitude,
    longitude: property.longitude,
    amenities: property.amenities,
    images: property.images,
    rooms: property.rooms,
    reviews: property.reviews,
    owner: {
      name: property.owner.name,
      isVerified: property.owner.ownerVerification?.status === 'APPROVED',
    },
  } satisfies PublicPropertyDetailDTO;
}

type PublicPropertyDetailDTO = {
  id: string;
  name: string;
  description: string;
  propertyType: PropertyRecord['propertyType'];
  monthlyPrice: number;
  availability: PropertyRecord['availability'];
  availableRooms: number;
  address: string;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  amenities: PropertyRecord['amenities'];
  images: PropertyRecord['images'];
  rooms: PublicPropertyDetailRecord['rooms'];
  reviews: PublicPropertyDetailRecord['reviews'];
  owner: { name: string; isVerified: boolean };
};

export async function getOwnerProperty(ownerId: string, id: string) {
  const property = await prisma.property.findFirst({
    where: { id, ownerId },
    include: propertyInclude,
  });
  if (!property) throw notFound();
  return toPropertyDTO(property);
}

export async function createProperty(ownerId: string, input: PropertyInput) {
  const [{ locationId, amenityIds }, settings] = await Promise.all([
    resolveReferences(input),
    getPlatformSettings(),
  ]);

  const property = await prisma.property.create({
    data: {
      ...scalarFields(input, locationId),
      ownerId,
      status: settings.autoApproveListings ? 'APPROVED' : 'PENDING',
      amenities: { connect: amenityIds },
      images: { create: imageRows(input.imageUrls) },
    },
    include: propertyInclude,
  });
  return toPropertyDTO(property);
}

export async function updateProperty(ownerId: string, id: string, input: PropertyInput) {
  const existing = await prisma.property.findFirst({
    where: { id, ownerId },
    select: { id: true, images: { select: { url: true, sortOrder: true } } },
  });
  if (!existing) throw notFound();
  const knownImageUrls = new Set(existing.images.map((image) => image.url));
  const legacyImagesToAppend = [...new Set(input.imageUrls)].filter((url) => !knownImageUrls.has(url));
  if (existing.images.length + legacyImagesToAppend.length > MAX_PROPERTY_IMAGES) {
    throw new HttpError(400, `A property can have up to ${MAX_PROPERTY_IMAGES} images.`);
  }

  const [{ locationId, amenityIds }, settings] = await Promise.all([
    resolveReferences(input),
    getPlatformSettings(),
  ]);

  const property = await prisma.property.update({
    where: { id },
    data: {
      ...scalarFields(input, locationId),
      // Otherwise, any change needs a fresh admin review.
      status: settings.autoApproveListings ? 'APPROVED' : 'PENDING',
      rejectionReason: null,
      amenities: { set: amenityIds },
      images: {
        create: legacyImagesToAppend.map((url, index) => ({
          url,
          isPrimary: existing.images.length === 0 && index === 0,
          sortOrder: existing.images.length + index,
        })),
      },
    },
    include: propertyInclude,
  });
  return toPropertyDTO(property);
}

export async function addPropertyImages(
  ownerId: string,
  propertyId: string,
  files: Express.Multer.File[],
) {
  if (files.length === 0) throw new HttpError(400, 'Select at least one image to upload.');

  const savedUrls: string[] = [];
  try {
    await prisma.$transaction(async (transaction) => {
      const property = await transaction.property.findFirst({
        where: { id: propertyId, ownerId },
        select: { id: true, images: { select: { id: true, sortOrder: true } } },
      });
      if (!property) throw notFound();
      if (property.images.length + files.length > MAX_PROPERTY_IMAGES) {
        throw new HttpError(400, `A property can have up to ${MAX_PROPERTY_IMAGES} images.`);
      }

      for (const file of files) {
        savedUrls.push(await savePropertyImage(file.buffer, file.mimetype));
      }
      await transaction.propertyImage.createMany({
        data: savedUrls.map((url, index) => ({
          propertyId,
          url,
          isPrimary: property.images.length === 0 && index === 0,
          sortOrder: property.images.length + index,
        })),
      });
    });
  } catch (error) {
    await Promise.all(savedUrls.map(removeStoredPropertyImage));
    throw error;
  }

  return getOwnerProperty(ownerId, propertyId);
}

export async function removePropertyImage(ownerId: string, propertyId: string, imageId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } },
  });
  if (!property) throw notFound();
  const image = property.images.find((item) => item.id === imageId);
  if (!image) throw new HttpError(404, 'Property image not found.');

  const remaining = property.images.filter((item) => item.id !== imageId);
  await prisma.$transaction([
    prisma.propertyImage.delete({ where: { id: imageId } }),
    ...remaining.map((item, index) => prisma.propertyImage.update({
      where: { id: item.id },
      data: { isPrimary: index === 0, sortOrder: index },
    })),
  ]);
  await removeStoredPropertyImage(image.url);
  return getOwnerProperty(ownerId, propertyId);
}

export async function setPropertyCoverImage(ownerId: string, propertyId: string, imageId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId },
    include: { images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] } },
  });
  if (!property) throw notFound();
  if (!property.images.some((image) => image.id === imageId)) {
    throw new HttpError(404, 'Property image not found.');
  }

  const orderedImages = [property.images.find((image) => image.id === imageId)!,
    ...property.images.filter((image) => image.id !== imageId)];
  await prisma.$transaction(orderedImages.map((image, index) =>
    prisma.propertyImage.update({
      where: { id: image.id },
      data: { isPrimary: index === 0, sortOrder: index },
    }),
  ));
  return getOwnerProperty(ownerId, propertyId);
}

export async function deleteProperty(ownerId: string, id: string) {
  const property = await prisma.property.findFirst({
    where: { id, ownerId },
    select: {
      id: true,
      images: { select: { url: true } },
      _count: { select: { paymentRecords: true } },
    },
  });
  if (!property) throw notFound();
  if (property._count.paymentRecords > 0) {
    throw new HttpError(409, 'Properties with payment records cannot be deleted.');
  }
  let result: { count: number };
  try {
    result = await prisma.property.deleteMany({ where: { id, ownerId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new HttpError(409, 'Properties with payment records cannot be deleted.');
    }
    throw error;
  }
  if (result.count === 0) throw notFound();
  await Promise.all(property.images.map((image) => removeStoredPropertyImage(image.url)));
}

// ---------------------------------------------------------------------------
// Admin listing moderation
// ---------------------------------------------------------------------------

export async function listPropertiesForAdmin(status?: PropertyStatus) {
  const properties = await prisma.property.findMany({
    where: status ? { status } : {},
    include: adminPropertyInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return properties.map(toAdminPropertyDTO);
}

export async function setPropertyStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED' | 'INACTIVE',
  rejectionReason?: string,
) {
  const existing = await prisma.property.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound();

  const property = await prisma.property.update({
    where: { id },
    data: { status, rejectionReason: status === 'REJECTED' ? (rejectionReason ?? null) : null },
    include: adminPropertyInclude,
  });
  return toAdminPropertyDTO(property);
}
