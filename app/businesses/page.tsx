import { Metadata } from 'next';
import CategoryChips from './_components/CategoryChips';
import SearchBar from './_components/SearchBar';
import DirectoryGrid from './_components/DirectoryGrid';
import { GooglePlacesProvider } from '@/lib/providers/googlePlaces';
import { YelpProvider } from '@/lib/providers/yelp';
import { getEnvNumber, Provider, ProviderClient } from '@/lib/providers/base';
import { Business } from '@/types/business';

export const metadata: Metadata = {
  title: 'Best Local Businesses in Salt Lake City — Directory',
  description: 'Find top-rated coffee, plumbers, HVAC, restaurants, and more in Salt Lake City.',
};

const DEFAULT_CATEGORY = 'Coffee';
const DEF_LAT = getEnvNumber(process.env.CITY_DEFAULT_LAT, 40.7608);
const DEF_LNG = getEnvNumber(process.env.CITY_DEFAULT_LNG, -111.8910);
const DEF_RADIUS = getEnvNumber(process.env.CITY_RADIUS_M, 15000);

// SSR helper
async function serverSearch(params: { q?: string | null; category?: string | null; lat?: number; lng?: number; radius?: number; page?: string | null; }): Promise<{ items: Business[]; nextCursor: string | null; provider: Provider }> {
  const providerName = (process.env.BUSINESS_PROVIDER || 'google').toLowerCase() as Provider;
  const client: ProviderClient =
    providerName === 'yelp'
      ? new YelpProvider(process.env.YELP_API_KEY)
      : new GooglePlacesProvider(process.env.GOOGLE_MAPS_API_KEY);

  const lat = Number.isFinite(params.lat) ? (params.lat as number) : DEF_LAT;
  const lng = Number.isFinite(params.lng) ? (params.lng as number) : DEF_LNG;
  const radius = Number.isFinite(params.radius) ? (params.radius as number) : DEF_RADIUS;

  try {
    const res = await client.searchBusinesses({
      q: params.q || null,
      category: params.category || DEFAULT_CATEGORY,
      lat, lng, radius,
      page: params.page || null,
    });
    return { items: res.items, nextCursor: res.nextCursor, provider: res.provider };
  } catch {
    return { items: [], nextCursor: null, provider: providerName };
  }
}

export default async function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined>; }) {
  const category = typeof searchParams.category === 'string' ? searchParams.category : DEFAULT_CATEGORY;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;
  const page = typeof searchParams.page === 'string' ? searchParams.page : undefined;
  const lat = searchParams.lat ? Number(searchParams.lat) : undefined;
  const lng = searchParams.lng ? Number(searchParams.lng) : undefined;

  const { items, nextCursor, provider } = await serverSearch({ q, category, lat, lng, page });

  // JSON-LD ItemList (first 10)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.slice(0, 10).map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: b.name,
        url: b.website || undefined,
        address: b.address || undefined,
      },
    })),
  };

  const missingProviderKey =
    (process.env.BUSINESS_PROVIDER || 'google').toLowerCase() === 'google'
      ? !process.env.GOOGLE_MAPS_API_KEY
      : !process.env.YELP_API_KEY;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-2xl font-bold text-gray-100">Top Local Businesses in Salt Lake City</h1>
      <p className="mt-1 text-sm text-gray-400">
        Discover the best coffee shops, restaurants, plumbers, HVAC services and more—rated by locals.
      </p>

      <div className="mt-4">
        <CategoryChips />
      </div>

      <div className="mt-3">
        <SearchBar />
      </div>

      {missingProviderKey ? (
        <div className="mt-6 rounded-2xl border border-yellow-700 bg-yellow-900/20 p-4 text-yellow-200">
          <p className="text-sm">
            API keys missing. Add <code className="rounded bg-black/40 px-1">GOOGLE_MAPS_API_KEY</code> or <code className="rounded bg-black/40 px-1">YELP_API_KEY</code> to your
            <code className="ml-1 rounded bg-black/40 px-1">.env.local</code>. Until then, the directory will show a placeholder.
          </p>
        </div>
      ) : null}

      <DirectoryGrid initialItems={items} initialNextCursor={nextCursor} provider={provider} />
    </div>
  );
}
