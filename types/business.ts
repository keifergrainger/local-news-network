// types/business.ts

export type BusinessSource = "google" | "yelp" | "geoapify";

export interface Business {
  id: string;
  name: string;

  // Ratings / reviews - allow null because some providers may not send them
  rating: number | null;
  reviewCount: number | null;

  // Display address
  address: string;

  // Optional extras
  website?: string | null;
  openNow?: boolean | null;
  photoUrl?: string | null;

  // Map position
  lat: number;
  lng: number;

  // Which provider it came from
  source: BusinessSource;

  // Category labels (e.g. "restaurant", "plumber", etc.)
  categories: string[];
}
