import { Business } from "@/types/business";
import { ProviderClient, ProviderResult, SearchInput } from "./base";

const API = "https://api.geoapify.com/v2/places";

// --- helpers ---
function slug(s?: string | null) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const CAT_MAP: Record<string, string> = {
  // UI chip -> Geoapify categories
  "coffee": "catering.cafe",
  "restaurants": "catering.restaurant",
  "bars": "catering.bar",
  "gyms": "sport.fitness_centre,sport.sports_centre",
  "plumbers": "service.plumber",
  "electricians": "service.electrician",
  "hvac": "service.hvac,service.air_conditioning",
  "landscapers": "service.gardener,service.landscaping",
  "pest-control": "service.pest_control",
  "real-estate": "service.estate_agent,office.estate_agent",
  // synonyms
  "bar": "catering.bar",
  "gym": "sport.fitness_centre,sport.sports_centre",
  "plumber": "service.plumber",
  "electrician": "service.electrician",
};

function categoriesFor(category?: string | null): string | null {
  const s = slug(category);
  if (s && CAT_MAP[s]) return CAT_MAP[s];
  return null;
}

export class GeoapifyProvider implements ProviderClient {
  apiKey: string;
  constructor(apiKey?: string) { this.apiKey = apiKey || ""; }

  async searchBusinesses(input: SearchInput): Promise<ProviderResult> {
    if (!this.apiKey) return { items: [], nextCursor: null, provider: "geoapify" };

    const limit = 20;
    const offset = input.page ? Number(input.page) || 0 : 0;

    const cats = categoriesFor(input.category);
    const url = new URL(API);

    if (cats) url.searchParams.set("categories", cats);

    const q = (input.q || "").trim();
    if (q) url.searchParams.set("name", q);

    if (!cats && !q) url.searchParams.set("categories", "commercial,service,catering");
    if (!cats && input.category) {
      const existing = url.searchParams.get("name");
      url.searchParams.set("name", (existing ? existing + " " : "") + String(input.category));
    }

    // circle filter (lon,lat,radiusMeters)
    url.searchParams.set(
      "filter",
      `circle:${input.lng},${input.lat},${Math.max(100, Math.min(input.radius, 40000))}`
    );
    url.searchParams.set("bias", `proximity:${input.lng},${input.lat}`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", this.apiKey);

    const r = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!r.ok) throw new Error(`Geoapify error ${r.status}`);
    const j: any = await r.json();

    const features: any[] = Array.isArray(j.features) ? j.features : [];
    const items: Business[] = features.map((f) => {
      const p = f.properties || {};
      const coords = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : [undefined, undefined];
      const addr = p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(", ");
      const rawCategories = Array.isArray(p.categories) ? p.categories : [];
      return {
        id: p.place_id || `${p.osm_id || ""}-${p.name || ""}-${addr}`,
        name: p.name || "Unknown",
        rating: undefined,
        reviewCount: undefined,
        address: addr || undefined,
        website: p.website || p.datasource?.raw?.contact?.website || undefined,
        openNow: undefined,
        lat: typeof coords[1] === "number" ? coords[1] : undefined,
        lng: typeof coords[0] === "number" ? coords[0] : undefined,
        photoUrl: undefined,
        source: "geoapify",
        categories: rawCategories.map((c: unknown) => (typeof c === "string" ? c : String(c))).filter(Boolean),
      };
    });

    const hasMore = features.length === limit;
    const nextCursor = hasMore ? String(offset + limit) : null;

    return { items, nextCursor, provider: "geoapify" };
  }
}
