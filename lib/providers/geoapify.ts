// =====================================================
// 2) lib/providers/geoapify.ts  (NEW FILE)
// Notes:
// - Uses Geoapify Places (free tier ~3k/day).
// - Ratings are generally not available in OSM; we omit.
// - Pagination via limit+offset; we return nextCursor as offset string.
// =====================================================
import { Business } from '@/types/business';
import { ProviderClient, ProviderResult, SearchInput } from './base';

const API = 'https://api.geoapify.com/v2/places';

const CAT_MAP: Record<string, string> = {
  // Maps your UI categories to Geoapify categories list
  Coffee: 'catering.cafe',
  Restaurants: 'catering.restaurant',
  Bars: 'catering.bar',
  Plumbers: 'service.plumber',
  Electricians: 'service.electrician',
  HVAC: 'service.hvac,service.air_conditioning', // if one is missing, other still works
  Gyms: 'sport.fitness_centre,sport.sports_centre',
  Landscapers: 'service.gardener,service.landscaping',
  'Pest Control': 'service.pest_control',
  'Real Estate': 'service.estate_agent,office.estate_agent',
};

function toCategories(category?: string | null, q?: string | null) {
  // Prefer explicit category; fall back to a broad guess, then name search.
  const key = (category || '').trim();
  if (key && CAT_MAP[key]) return CAT_MAP[key];
  // If no mapped category, try generic shopping/food/service buckets
  if ((q || '').trim()) return ''; // we'll rely on name=<q>
  return 'commercial,service,catering';
}

export class GeoapifyProvider implements ProviderClient {
  apiKey: string;
  constructor(apiKey?: string) { this.apiKey = apiKey || ''; }

  async searchBusinesses(input: SearchInput): Promise<ProviderResult> {
    if (!this.apiKey) return { items: [], nextCursor: null, provider: 'geoapify' };

    const limit = 20;
    const offset = input.page ? Number(input.page) || 0 : 0;

    const categories = toCategories(input.category, input.q);
    const url = new URL(API);
    if (categories) url.searchParams.set('categories', categories);
    if (input.q && !categories) url.searchParams.set('name', input.q);

    // circle filter (lon,lat,radiusMeters)
    url.searchParams.set('filter', `circle:${input.lng},${input.lat},${Math.max(100, Math.min(input.radius, 40000))}`);
    url.searchParams.set('bias', `proximity:${input.lng},${input.lat}`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('lang', 'en');
    url.searchParams.set('apiKey', this.apiKey);

    const r = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!r.ok) throw new Error(`Geoapify error ${r.status}`);
    const j: any = await r.json();

    const features: any[] = Array.isArray(j.features) ? j.features : [];
    const items: Business[] = features.map((f) => {
      const p = f.properties || {};
      const coords = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : [undefined, undefined];
      const addr = p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(', ');
      return {
        id: p.place_id || `${p.osm_id || ''}-${p.name || ''}-${addr}`,
        name: p.name || 'Unknown',
        rating: undefined,             // OSM data has no star ratings
        reviewCount: undefined,
        address: addr || undefined,
        website: p.website || p.datasource?.raw?.contact?.website || undefined,
        openNow: undefined,            // available via Place Details; we skip in free mode
        lat: typeof coords[1] === 'number' ? coords[1] : undefined,
        lng: typeof coords[0] === 'number' ? coords[0] : undefined,
        photoUrl: undefined,           // no photos; keeps it free
        source: 'geoapify',
        categories: Array.isArray(p.categories) ? p.categories : [],
      };
    });

    const hasMore = features.length === limit;
    const nextCursor = hasMore ? String(offset + limit) : null;

    return { items, nextCursor, provider: 'geoapify' };
  }
}
