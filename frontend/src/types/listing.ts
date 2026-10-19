// Property listings as returned by the owner API (Phase 4).
// Named "Listing" so it does not clash with the mock `Property` type used by the landing page.
export type ListingType = 'BOARDING_HOUSE' | 'APARTMENT' | 'ROOM' | 'BEDSPACE';
export type ListingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
export type ListingAvailability = 'AVAILABLE' | 'FULLY_OCCUPIED' | 'COMING_SOON';

export interface AmenityOption {
  id: string;
  slug: string;
  name: string;
}

export interface LocationOption {
  id: string;
  name: string;
}

export interface ListingImage {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Listing {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  propertyType: ListingType;
  monthlyPrice: number;
  availability: ListingAvailability;
  availableRooms: number;
  address: string;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  status: ListingStatus;
  rejectionReason: string | null;
  amenities: AmenityOption[];
  images: ListingImage[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicListing {
  id: string;
  name: string;
  description: string;
  propertyType: ListingType;
  monthlyPrice: number;
  availability: ListingAvailability;
  availableRooms: number;
  address: string;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  amenities: AmenityOption[];
  images: ListingImage[];
}

export interface PublicListingSearchResponse {
  status: 'ok';
  properties: PublicListing[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface PublicRoom {
  id: string;
  name: string;
  monthlyPrice: number | null;
  capacity: number;
  isAvailable: boolean;
}

export interface PublicListingDetail extends PublicListing {
  rooms: PublicRoom[];
  reviews: { id: string; rating: number; content: string; createdAt: string }[];
  owner: { name: string; isVerified: boolean };
}

// What the form sends to the API
export interface ListingPayload {
  name: string;
  propertyType: ListingType;
  description: string;
  monthlyPrice: number | undefined;
  municipality: string;
  address: string;
  availableRooms: number | undefined;
  availability: ListingAvailability;
  amenities: string[];
  imageUrls?: string[];
}
