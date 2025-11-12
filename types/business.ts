export type Business = {
  id: string;
  name: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  website?: string;
  openNow?: boolean;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  source: 'google' | 'yelp' | 'geoapify';
  categories: string[];
};
