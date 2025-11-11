// ===============================================
// 1) lib/providers/base.ts  (REPLACE the whole file)
// ===============================================
import { Business } from '@/types/business';

export type Provider = 'google' | 'yelp' | 'geoapify';

export type SearchInput = {
  q?: string | null;
  category?: string | null;
  lat: number;
  lng: number;
  radius: number; // meters
  page?: string | null; // provider cursor (token or offset)
};

export type ProviderResult = {
  items: Business[];
  nextCursor: string | null;
  provider: Provider;
};

export interface ProviderClient {
  searchBusinesses(input: SearchInput): Promise<ProviderResult>;
}

export function getEnvNumber(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
