// MOCK DATA - for the Phase 2 landing page UI only.
// Nothing here comes from the database. It will be replaced by real API data later.
import type { LocationInfo, Property, PropertyType } from '../types/property';

export const PROPERTY_TYPES: PropertyType[] = ['Boarding House', 'Apartment', 'Room', 'Bedspace'];

export const BUDGET_OPTIONS = [
  { value: 'under-1500', label: 'Below ₱1,500' },
  { value: '1500-3000', label: '₱1,500 – ₱3,000' },
  { value: '3000-5000', label: '₱3,000 – ₱5,000' },
  { value: '5000-8000', label: '₱5,000 – ₱8,000' },
  { value: 'over-8000', label: 'Above ₱8,000' },
];

export const LOCATIONS: LocationInfo[] = [
  { name: 'Mamburao', listingCount: 18 },
  { name: 'San Jose', listingCount: 42 },
  { name: 'Sablayan', listingCount: 24 },
  { name: 'Calintaan', listingCount: 9 },
  { name: 'Rizal', listingCount: 7 },
  { name: 'Abra de Ilog', listingCount: 8 },
  { name: 'Paluan', listingCount: 5 },
  { name: 'Santa Cruz', listingCount: 6 },
  { name: 'Looc', listingCount: 4 },
  { name: 'Lubang', listingCount: 6 },
  { name: 'Magsaysay', listingCount: 11 },
];

export const FEATURED_PROPERTIES: Property[] = [
  {
    id: 'p1',
    title: 'Sampaguita Student Boarding House',
    type: 'Boarding House',
    municipality: 'San Jose',
    area: 'Walking distance to the public market',
    monthlyPrice: 1800,
    amenities: ['Wi-Fi', 'Shared kitchen', 'Study area'],
    verified: true,
    studentFriendly: true,
  },
  {
    id: 'p2',
    title: 'Casa Bella Studio Apartment',
    type: 'Apartment',
    municipality: 'Mamburao',
    area: 'Near the town plaza',
    monthlyPrice: 4500,
    amenities: ['Own bathroom', 'Wi-Fi ready', 'Parking'],
    verified: true,
    studentFriendly: false,
  },
  {
    id: 'p3',
    title: 'Bayside Bedspace for Students',
    type: 'Bedspace',
    municipality: 'Sablayan',
    area: '5 minutes from the town proper',
    monthlyPrice: 1200,
    amenities: ['Electric fan', 'Shared bathroom', 'Lockers'],
    verified: true,
    studentFriendly: true,
  },
  {
    id: 'p4',
    title: 'Mango Grove Private Room',
    type: 'Room',
    municipality: 'Calintaan',
    area: 'Quiet residential street',
    monthlyPrice: 2500,
    amenities: ['Own room', 'Water included', 'Secure gate'],
    verified: false,
    studentFriendly: true,
  },
  {
    id: 'p5',
    title: 'Palm Court Family Apartment',
    type: 'Apartment',
    municipality: 'San Jose',
    area: 'Along the national highway',
    monthlyPrice: 6500,
    amenities: ['2 bedrooms', 'Kitchen', 'Parking'],
    verified: true,
    studentFriendly: false,
  },
  {
    id: 'p6',
    title: 'Island View Rooms',
    type: 'Room',
    municipality: 'Lubang',
    area: 'Near the port area',
    monthlyPrice: 2000,
    amenities: ['Shared kitchen', 'Laundry area', 'Fan'],
    verified: false,
    studentFriendly: false,
  },
];

export const FEATURES = [
  { icon: BadgeCheck, title: 'Verified Listings', description: 'Listings are reviewed so you can browse with more confidence and fewer surprises.' },
  { icon: MapPin, title: 'Location-Based Search', description: 'Look up places by municipality and find stays close to school, work, or family.' },
  { icon: Wallet, title: 'Affordable Rentals', description: 'Filter by monthly budget to find rooms and bedspaces that fit your allowance or salary.' },
  { icon: GraduationCap, title: 'Student-Friendly Properties', description: 'Spot boarding houses made for students, with study areas, Wi-Fi, and sensible house rules.' },
  { icon: MessageCircle, title: 'Easy Owner Contact', description: 'Reach property owners directly to ask questions and schedule a visit.' },
];
import {
  BadgeCheck,
  GraduationCap,
  MapPin,
  MessageCircle,
  Wallet,
} from 'lucide-react';
