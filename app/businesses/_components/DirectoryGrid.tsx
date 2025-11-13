'use client';
import { Business } from "@/types/business";
import BusinessCard from "./BusinessCard";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const API = "https://api.geoapify.com/v2/places";

const CATEGORY_MAP: Record<string, string> = {
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
  "bar": "catering.bar",
  "gym": "sport.fitness_centre,sport.sports_centre",
  "plumber": "service.plumber",
  "electrician": "service.electrician",
};

function slugify(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoriesFor(category?: string | null) {
  const slug = slugify(category);
  return slug ? CATEGORY_MAP[slug] || null : null;
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function featureToBusiness(feature: any): Business {
  const props = feature?.properties ?? {};
  const coords = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [undefined, undefined];
  const address = props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join(", ") || undefined;

  return {
    id: props.place_id || `${props.osm_id || ""}-${props.name || ""}-${address || "unknown"}`,
    name: props.name || "Unknown",
    rating: undefined,
    reviewCount: undefined,
    address,
    website: props.website || props.datasource?.raw?.contact?.website || undefined,
    openNow: undefined,
    lat: typeof coords[1] === "number" ? coords[1] : undefined,
    lng: typeof coords[0] === "number" ? coords[0] : undefined,
    photoUrl: undefined,
    source: "geoapify",
    categories: Array.isArray(props.categories) ? props.categories : [],
  };
}

async function fetchGeoapify({
  params,
  defaults,
  signal,
  apiKey,
}: {
  params: URLSearchParams;
  defaults: { lat: number; lng: number; radius: number; category: string };
  signal: AbortSignal;
  apiKey: string | null;
}): Promise<{ items: Business[]; nextCursor: string | null }> {
  if (!apiKey) {
    return { items: [], nextCursor: null };
  }

  const categoryParam = params.get("category") || defaults.category;
  const searchQuery = params.get("q");
  const offsetParam = params.get("page");
  const lat = parseNumber(params.get("lat"), defaults.lat);
  const lng = parseNumber(params.get("lng"), defaults.lng);
  const radius = parseNumber(params.get("radius"), defaults.radius);

  const limit = 20;
  const offset = parseNumber(offsetParam, 0);
  const categories = categoriesFor(categoryParam);

  const url = new URL(API);
  if (categories) url.searchParams.set("categories", categories);

  const trimmedQuery = (searchQuery || "").trim();
  if (trimmedQuery) url.searchParams.set("name", trimmedQuery);

  if (!categories && !trimmedQuery) {
    url.searchParams.set("categories", "commercial,service,catering");
  }

  if (!categories && categoryParam) {
    const existing = url.searchParams.get("name");
    url.searchParams.set("name", `${existing ? `${existing} ` : ""}${categoryParam}`.trim());
  }

  url.searchParams.set("filter", `circle:${lng},${lat},${Math.max(100, Math.min(radius, 40000))}`);
  url.searchParams.set("bias", `proximity:${lng},${lat}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(Math.max(0, offset)));
  url.searchParams.set("lang", "en");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Geoapify error ${response.status}`);
  }

  const json: any = await response.json();
  const features: any[] = Array.isArray(json?.features) ? json.features : [];
  const items = features.map(featureToBusiness);
  const hasMore = features.length === limit;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return { items, nextCursor };
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
      <div className="h-40 w-full animate-pulse bg-gray-900" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-900" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-900" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-900" />
      </div>
    </div>
  );
}

export default function DirectoryGrid({
  provider,
  defaultLat,
  defaultLng,
  defaultRadius,
  defaultCategory,
  apiKey,
}: {
  provider: "google" | "yelp" | "geoapify";
  defaultLat: number;
  defaultLng: number;
  defaultRadius: number;
  defaultCategory: string;
  apiKey: string | null;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const defaults = useMemo(
    () => ({ lat: defaultLat, lng: defaultLng, radius: defaultRadius, category: defaultCategory }),
    [defaultLat, defaultLng, defaultRadius, defaultCategory]
  );

  const [items, setItems] = useState<Business[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [providerName] = useState(provider);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevStack = useRef<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const params = sp.toString();
    if (!apiKey) {
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      setError(null);
      return () => controller.abort();
    }

    setLoading(true);
    setError(null);

    fetchGeoapify({ params: new URLSearchParams(params), defaults, signal: controller.signal, apiKey })
      .then(({ items, nextCursor }) => {
        setItems(items);
        setNextCursor(nextCursor);
        prevStack.current = [];
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setItems([]);
        setNextCursor(null);
        setError("Unable to load businesses right now. Please try again later.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [sp, defaults, apiKey]);

  function goNext() {
    if (!nextCursor) return;
    const qs = new URLSearchParams(sp.toString());
    const current = qs.get("page") || "";
    if (current) prevStack.current.push(current);
    qs.set("page", nextCursor);
    router.push(`${pathname}?${qs.toString()}`);
  }

  function goPrev() {
    const qs = new URLSearchParams(sp.toString());
    const prev = prevStack.current.pop();
    if (prev) qs.set("page", prev);
    else qs.delete("page");
    router.push(`${pathname}?${qs.toString()}`);
  }

  const q = sp.get("q") || "";
  const category = sp.get("category") || defaultCategory;
  const empty = !loading && !error && items.length === 0;

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <span>Provider:</span>
        <span className="rounded border border-gray-700 px-2 py-0.5">{providerName}</span>
        <span className="ml-2">Query:</span>
        <span className="rounded border border-gray-700 px-2 py-0.5">{q || category}</span>
        <button
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const qs = new URLSearchParams(sp.toString());
                qs.set("lat", String(pos.coords.latitude));
                qs.set("lng", String(pos.coords.longitude));
                qs.delete("page");
                router.push(`${pathname}?${qs.toString()}`);
              },
              () => {},
              { enableHighAccuracy: true, timeout: 5000 }
            );
          }}
          className="btn btn-ghost btn-sm whitespace-nowrap"
          aria-label="Use your location"
        >
          Use my location
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6 text-center text-red-200">
          <h3 className="mb-2 text-lg font-semibold">Error loading businesses</h3>
          <p className="text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : empty ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-center">
          <h3 className="mb-2 text-lg font-semibold text-gray-100">No results found</h3>
          <p className="mb-4 text-sm text-gray-400">
            Try a different category or search term. You can also submit a business to help us grow the directory.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b) => (
              <BusinessCard key={`${b.source}-${b.id}`} b={b} />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={goPrev} className="btn btn-ghost btn-sm whitespace-nowrap" disabled={prevStack.current.length === 0}>
              ← Prev
            </button>
            <button onClick={goNext} className="btn btn-ghost btn-sm whitespace-nowrap" disabled={!nextCursor}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
