'use client';
import { Business } from "@/types/business";
import BusinessCard from "./BusinessCard";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

async function fetchBusinesses({
  params,
  defaults,
  signal,
}: {
  params: URLSearchParams;
  defaults: { lat: number; lng: number; radius: number; category: string };
  signal: AbortSignal;
}): Promise<{ items: Business[]; nextCursor: string | null; provider: string; error?: string | null }> {
  const search = new URLSearchParams(params);

  if (!search.get("category")) {
    search.set("category", defaults.category);
  }

  if (!search.get("lat")) {
    search.set("lat", String(defaults.lat));
  }

  if (!search.get("lng")) {
    search.set("lng", String(defaults.lng));
  }

  if (!search.get("radius")) {
    search.set("radius", String(defaults.radius));
  }

  const response = await fetch(`/api/businesses?${search.toString()}`, {
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const json: any = await response.json();

  return {
    items: Array.isArray(json?.items) ? json.items : [],
    nextCursor: typeof json?.nextCursor === "string" ? json.nextCursor : null,
    provider: typeof json?.provider === "string" ? json.provider : "geoapify",
    error: typeof json?.error === "string" ? json.error : null,
  };
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
}: {
  provider: "google" | "yelp" | "geoapify";
  defaultLat: number;
  defaultLng: number;
  defaultRadius: number;
  defaultCategory: string;
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
  const [providerName, setProviderName] = useState(provider);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevStack = useRef<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const params = sp.toString();
    setLoading(true);
    setError(null);

    fetchBusinesses({ params: new URLSearchParams(params), defaults, signal: controller.signal })
      .then(({ items, nextCursor, provider, error }) => {
        setItems(items);
        setNextCursor(nextCursor);
        if (provider === "geoapify" || provider === "google" || provider === "yelp") {
          setProviderName(provider);
        }
        if (error === "missing_key") {
          setError("Geoapify API key is missing. Please add your API key and try again.");
        } else if (error === "upstream_error") {
          setError("Geoapify is unavailable right now. Please try again shortly.");
        }
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
  }, [sp, defaults]);

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
