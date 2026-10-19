import type { ListingAvailability, ListingStatus, ListingType } from '../types/listing';

export const TYPE_LABEL: Record<ListingType, string> = {
  BOARDING_HOUSE: 'Boarding House',
  APARTMENT: 'Apartment',
  ROOM: 'Room',
  BEDSPACE: 'Bedspace',
};

export const AVAILABILITY_LABEL: Record<ListingAvailability, string> = {
  AVAILABLE: 'Available',
  FULLY_OCCUPIED: 'Fully occupied',
  COMING_SOON: 'Coming soon',
};

export const STATUS_LABEL: Record<ListingStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  INACTIVE: 'Inactive',
};

export const STATUS_STYLE: Record<ListingStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  INACTIVE: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export const formatPeso = (amount: number) => peso.format(amount);
