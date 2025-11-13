import { CityConfig } from "@/lib/cities";
import { Business } from "@/types/business";
import { ProviderResult, SearchInput } from "./base";

const LIMIT = 9;

type Template = {
  key: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  latOffset: number;
  lngOffset: number;
};

const BASE_TEMPLATES: Template[] = [
  {
    key: "coffee",
    name: "Summit Coffee Roasters",
    category: "coffee",
    rating: 4.8,
    reviewCount: 217,
    latOffset: 0.0081,
    lngOffset: -0.0042,
  },
  {
    key: "restaurants",
    name: "Main Street Kitchen",
    category: "restaurants",
    rating: 4.6,
    reviewCount: 189,
    latOffset: -0.005,
    lngOffset: 0.0064,
  },
  {
    key: "bars",
    name: "Copper Lantern Bar",
    category: "bars",
    rating: 4.7,
    reviewCount: 132,
    latOffset: 0.0034,
    lngOffset: -0.0071,
  },
  {
    key: "gyms",
    name: "Pulse Athletic Club",
    category: "gyms",
    rating: 4.5,
    reviewCount: 164,
    latOffset: -0.0062,
    lngOffset: -0.0038,
  },
  {
    key: "plumbers",
    name: "Rapid Response Plumbing",
    category: "plumbers",
    rating: 4.9,
    reviewCount: 98,
    latOffset: 0.0045,
    lngOffset: 0.0027,
  },
  {
    key: "electricians",
    name: "Brightline Electric",
    category: "electricians",
    rating: 4.8,
    reviewCount: 121,
    latOffset: -0.0028,
    lngOffset: -0.0059,
  },
  {
    key: "hvac",
    name: "ClimateGuard HVAC",
    category: "hvac",
    rating: 4.7,
    reviewCount: 143,
    latOffset: 0.007,
    lngOffset: 0.0055,
  },
  {
    key: "landscapers",
    name: "Evergreen Landscapes",
    category: "landscapers",
    rating: 4.6,
    reviewCount: 112,
    latOffset: -0.0041,
    lngOffset: 0.0031,
  },
  {
    key: "pest-control",
    name: "Shield Pest Solutions",
    category: "pest control",
    rating: 4.9,
    reviewCount: 87,
    latOffset: 0.0019,
    lngOffset: -0.0025,
  },
  {
    key: "real-estate",
    name: "Cornerstone Realty Group",
    category: "real estate",
    rating: 4.8,
    reviewCount: 76,
    latOffset: -0.0073,
    lngOffset: 0.0016,
  },
  {
    key: "coffee",
    name: "Riverside Espresso Bar",
    category: "coffee",
    rating: 4.7,
    reviewCount: 154,
    latOffset: 0.0025,
    lngOffset: 0.0078,
  },
  {
    key: "restaurants",
    name: "Garden Table Bistro",
    category: "restaurants",
    rating: 4.6,
    reviewCount: 141,
    latOffset: -0.0012,
    lngOffset: -0.0084,
  },
];

function createBusiness(city: CityConfig, tpl: Template, index: number): Business {
  const cityLabel = `${city.city}, ${city.state}`;
  const lat = city.lat + tpl.latOffset;
  const lng = city.lon + tpl.lngOffset;
  return {
    id: `${city.host}-${index}`,
    name: `${tpl.name} (${city.city})`,
    rating: tpl.rating,
    reviewCount: tpl.reviewCount,
    address: `${Math.floor(200 + index * 3)} Main St, ${cityLabel}`,
    website: null,
    openNow: index % 3 === 0 ? true : index % 3 === 1 ? false : null,
    photoUrl: null,
    lat,
    lng,
    source: "local",
    categories: [tpl.category, tpl.key, "local business", city.city.toLowerCase()],
  };
}

function getFallbackBusinesses(city: CityConfig): Business[] {
  return BASE_TEMPLATES.map((tpl, i) => createBusiness(city, tpl, i));
}

function normalize(value?: string | null) {
  return (value || "").toLowerCase();
}

function matchesCategory(b: Business, category?: string | null) {
  if (!category) return true;
  const slug = normalize(category).replace(/[^a-z0-9]+/g, " ");
  return b.categories.some((c) => normalize(c).includes(slug.trim()) || slug.includes(normalize(c)));
}

function matchesQuery(b: Business, q?: string | null) {
  if (!q) return true;
  const needle = normalize(q);
  return (
    normalize(b.name).includes(needle) ||
    normalize(b.address).includes(needle) ||
    b.categories.some((c) => normalize(c).includes(needle))
  );
}

function withinRadius(b: Business, input: SearchInput) {
  const radiusMeters = Number.isFinite(input.radius) ? input.radius : 15000;
  if (!radiusMeters) return true;
  const maxDistanceKm = radiusMeters / 1000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - input.lat);
  const dLon = toRad(b.lng - input.lng);
  const lat1 = toRad(input.lat);
  const lat2 = toRad(b.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  return distanceKm <= maxDistanceKm + 0.5; // add slight buffer to keep results
}

export function fallbackSearch(city: CityConfig, input: SearchInput): ProviderResult {
  const all = getFallbackBusinesses(city);
  const filtered = all.filter(
    (b) => matchesCategory(b, input.category) && matchesQuery(b, input.q) && withinRadius(b, input)
  );

  const offset = input.page ? Number.parseInt(input.page, 10) || 0 : 0;
  const pageItems = filtered.slice(offset, offset + LIMIT);
  const nextCursor = offset + LIMIT < filtered.length ? String(offset + LIMIT) : null;

  return {
    items: pageItems,
    nextCursor,
    provider: "local",
  };
}
