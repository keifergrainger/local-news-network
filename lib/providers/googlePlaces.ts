import { Business } from '@/types/business';
import { ProviderClient, ProviderResult, SearchInput } from './base';

const GOOGLE_ENDPOINT = 'https://maps.googleapis.com/maps/api/place';

function categoryToQuery(category?: string | null, q?: string | null) {
  const cat = (category || '').trim();
  const text = (q || '').trim();
  if (text) return text;
  if (cat) return cat;
  return 'business'; // safe default
}

function googlePhotoUrl(photoRef: string, apiKey: string) {
  const url =
    `${GOOGLE_ENDPOINT}/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${encodeURIComponent(apiKey)}`;
  // Route through our proxy to avoid mixed-content / domain allow-list issues
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

async function fetchJson<T>(url: string) {
  const r = await fetch(url, { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error(`Google fetch failed ${r.status}`);
  return (await r.json()) as T;
}

export class GooglePlacesProvider implements ProviderClient {
  apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async searchBusinesses(input: SearchInput): Promise<ProviderResult> {
    if (!this.apiKey) {
      return { items: [], nextCursor: null, provider: 'google' };
    }

    const query = categoryToQuery(input.category, input.q);
    const textUrl = new URL(`${GOOGLE_ENDPOINT}/textsearch/json`);
    textUrl.searchParams.set('query', query);
    textUrl.searchParams.set('location', `${input.lat},${input.lng}`);
    textUrl.searchParams.set('radius', `${input.radius}`);
    textUrl.searchParams.set('key', this.apiKey);
    // Page token for next page
    if (input.page) textUrl.searchParams.set('pagetoken', input.page);

    type GText = {
      results: any[];
      status: string;
      next_page_token?: string;
    };

    const data = await fetchJson<GText>(textUrl.toString());

    const baseItems = (data.results || []).map((r) => {
      const b: Business = {
        id: r.place_id,
        name: r.name,
        rating: typeof r.rating === 'number' ? r.rating : undefined,
        reviewCount: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : undefined,
        address: r.formatted_address || r.vicinity,
        website: undefined, // filled by details
        openNow: r.opening_hours?.open_now ?? undefined,
        lat: r.geometry?.location?.lat,
        lng: r.geometry?.location?.lng,
        photoUrl: r.photos?.[0]?.photo_reference ? googlePhotoUrl(r.photos[0].photo_reference, this.apiKey) : undefined,
        source: 'google',
        categories: Array.isArray(r.types) ? r.types : [],
      };
      return b;
    });

    // Fetch details (website, maybe open_now if missing)
    const ids = baseItems.slice(0, 10).map((b) => b.id); // limit details calls
    const detailPromises = ids.map(async (placeId) => {
      const detailsUrl = new URL(`${GOOGLE_ENDPOINT}/details/json`);
      detailsUrl.searchParams.set('place_id', placeId);
      detailsUrl.searchParams.set('fields', 'website,opening_hours');
      detailsUrl.searchParams.set('key', this.apiKey);
      type GDetails = {
        result?: { website?: string; opening_hours?: { open_now?: boolean } };
        status: string;
      };
      try {
        const d = await fetchJson<GDetails>(detailsUrl.toString());
        return { placeId, website: d.result?.website, open_now: d.result?.opening_hours?.open_now };
      } catch {
        return { placeId, website: undefined, open_now: undefined };
      }
    });

    const details = await Promise.all(detailPromises);
    const detailMap = new Map(details.map((d) => [d.placeId, d]));

    const merged = baseItems.map((b) => {
      const d = detailMap.get(b.id);
      return {
        ...b,
        website: d?.website || b.website,
        openNow: typeof d?.open_now === 'boolean' ? d?.open_now : b.openNow,
      };
    });

    return {
      items: merged,
      nextCursor: data.next_page_token || null,
      provider: 'google',
    };
  }
}
