export type PropertyType = 'Boarding House' | 'Apartment' | 'Room' | 'Bedspace';

// Shape used by the UI. In a later phase this will match the data returned by the API.
export interface Property {
  id: string;
  title: string;
  type: PropertyType;
  municipality: string;
  area: string;
  monthlyPrice: number;
  amenities: string[];
  verified: boolean;
  studentFriendly: boolean;
}

export interface LocationInfo {
  name: string;
  listingCount: number;
}
