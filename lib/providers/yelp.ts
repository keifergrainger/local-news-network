import { ProviderClient, ProviderResult, SearchInput } from './base';
import { Business } from '@/types/business';

const YELP_ENDPOINT = 'https://api.yelp.com/v3/businesses/search';

function catToYelp(category?: string | null, q?: string | null) {
  // Rough mapping; Yelp uses slugs like "coffee", "plumbing", etc.
  const text = (q || '').trim();
  const cat = (category || '').trim();
  return {
    term: text || cat || 'business',
    categories: cat ? cat.toLowerCase().replace(/\s+/g, '') : undefined,
  };
}

export class YelpProvider implements ProviderClient {
  apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async searchBusinesses(input: SearchInput): Promise<ProviderResult> {
    if (!this.apiKey) {
      return { items: [], nextCursor: null, provider: 'yelp' };
    }

    const y = catToYelp(input.category, input.q);
    const url = new URL(YELP_ENDPOINT);
    url.searchParams.set('latitude', `${input.lat}`);
    url.searchParams.set('longitude', `${input.lng}`);
    url.searchParams.set('radius', `${Math.min(input.radius, 40000)}`); // Yelp max 40km
    url.searchParams.set('limit', '20');
    if (y.term) url.searchParams.set('term', y.term);
    if (y.categories) url.searchParams.set('categories', y.categories);

    const offset = input.page ? Number(input.page) : 0;
    if (offset > 0) url.searchParams.set('offset', String(offset));

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      next: { revalidate: 3600 },
    });
    if (!r.ok) throw new Error(`Yelp fetch failed ${r.status}`);
    const j: any = await r.json();

    const items: Business[] = (j.businesses || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      rating: typeof b.rating === 'number' ? b.rating : undefined,
      reviewCount: typeof b.review_count === 'number' ? b.review_count : undefined,
      address: (b.location?.display_address || []).join(', '),
      website: b.url, // Yelp page
      openNow: b.is_closed != null ? !b.is_closed : undefined,
      lat: b.coordinates?.latitude,
      lng: b.coordinates?.longitude,
      photoUrl: b.image_url ? `/api/image-proxy?url=${encodeURIComponent(b.image_url)}` : undefined,
      source: 'yelp',
      categories: Array.isArray(b.categories) ? b.categories.map((c: any) => c.title) : [],
    }));

    const total = typeof j.total === 'number' ? j.total : 0;
    const newOffset = offset + (Array.isArray(j.businesses) ? j.businesses.length : 0);
    const hasMore = newOffset < total;
    return { items, nextCursor: hasMore ? String(newOffset) : null, provider: 'yelp' };
  }
}
