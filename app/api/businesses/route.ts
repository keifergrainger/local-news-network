// =====================================================
// 3) app/api/businesses/route.ts  (REPLACE getProvider())
//    Only the selector changes; keep the rest of your file.
// =====================================================
import { NextRequest, NextResponse } from 'next/server';
import { getEnvNumber, Provider, ProviderClient, ProviderResult, SearchInput } from '@/lib/providers/base';
import { GooglePlacesProvider } from '@/lib/providers/googlePlaces';
import { YelpProvider } from '@/lib/providers/yelp';
import { GeoapifyProvider } from '@/lib/providers/geoapify';

// ... keep your existing config, cache & rate-limit code ...

function getProvider(): { name: Provider; client: ProviderClient; missingKey: boolean } {
  const p = (process.env.BUSINESS_PROVIDER || 'google').toLowerCase() as Provider;

  if (p === 'yelp') {
    const key = process.env.YELP_API_KEY || '';
    return { name: 'yelp', client: new YelpProvider(key), missingKey: !key };
  }

  if (p === 'geoapify') {
    const key = process.env.GEOAPIFY_API_KEY || '';
    return { name: 'geoapify', client: new GeoapifyProvider(key), missingKey: !key };
  }

  // default google
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  return { name: 'google', client: new GooglePlacesProvider(key), missingKey: !key };
}

// ... keep your existing GET() handler unchanged ...
