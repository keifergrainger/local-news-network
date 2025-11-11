'use client';

import { Business } from '@/types/business';
import BusinessCard from './BusinessCard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SubmitBusinessModal from './SubmitBusinessModal';

const PAGE_STACK_LIMIT = 10;

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

export default function DirectoryGrid({ initialItems, initialNextCursor, provider }: { initialItems: Business[]; initialNextCursor: string | null; provider: 'google' | 'yelp' }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<Business[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [openSubmit, setOpenSubmit] = useState(false);
  const [geoAllowed, setGeoAllowed] = useState(false);

  // Track previous cursors for "Prev"
  const prevStackRef = useRef<string[]>([]);
  // Hydrate when search params change (new search/category/near me)
  useEffect(() => {
    // Fetch fresh results for current params
    const params = sp.toString();
    setLoading(true);
    fetch(`/api/businesses?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j) => {
        setItems(j.items || []);
        setNextCursor(j.nextCursor || null);
        prevStackRef.current = [];
      })
      .catch(() => { /* show error via empty state */ })
      .finally(() => setLoading(false));
  }, [sp]);

  // Near me toggle
  async function toggleNearMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const qs = new URLSearchParams(sp.toString());
        qs.set('lat', String(pos.coords.latitude));
        qs.set('lng', String(pos.coords.longitude));
        qs.delete('page');
        router.push(`${pathname}?${qs.toString()}`);
        setGeoAllowed(true);
      },
      () => setGeoAllowed(false),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }

  // Pagination
  function goNext() {
    if (!nextCursor) return;
    const qs = new URLSearchParams(sp.toString());
    const currentCursor = qs.get('page') || '';
    if (currentCursor) {
      const stack = prevStackRef.current;
      if (stack.length >= PAGE_STACK_LIMIT) stack.shift();
      stack.push(currentCursor);
    }
    qs.set('page', nextCursor);
    router.push(`${pathname}?${qs.toString()}`);
  }

  function goPrev() {
    const stack = prevStackRef.current;
    const prev = stack.pop();
    const qs = new URLSearchParams(sp.toString());
    if (prev) qs.set('page', prev);
    else qs.delete('page');
    router.push(`${pathname}?${qs.toString()}`);
  }

  const q = sp.get('q') || '';
  const category = sp.get('category') || 'Coffee';
  const lat = sp.get('lat');
  const lng = sp.get('lng');

  const empty = !loading && items.length === 0;

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <span>Provider:</span>
        <span className="rounded border border-gray-700 px-2 py-0.5">{provider}</span>
        <span className="ml-2">Query:</span>
        <span className="rounded border border-gray-700 px-2 py-0.5">{q || category}</span>
        {lat && lng ? (
          <span className="ml-2 rounded border border-gray-700 px-2 py-0.5">Near you</span>
        ) : (
          <button onClick={toggleNearMe} className="ml-2 rounded border border-gray-700 px-2 py-0.5 hover:bg-gray-800" aria-label="Use your location">
            Use my location
          </button>
        )}
        <button onClick={() => setOpenSubmit(true)} className="ml-auto rounded border border-gray-700 px-2 py-0.5 hover:bg-gray-800" aria-label="Submit your business">
          Submit Your Business
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : empty ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-center">
          <h3 className="mb-2 text-lg font-semibold text-gray-100">No results found</h3>
          <p className="mb-4 text-sm text-gray-400">Try a different category or search term. You can also submit a business to help us grow the directory.</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setOpenSubmit(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500">Submit Your Business</button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(b => <BusinessCard key={`${b.source}-${b.id}`} b={b} />)}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={goPrev} className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50" disabled={prevStackRef.current.length === 0}>
              ← Prev
            </button>
            <button onClick={goNext} className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50" disabled={!nextCursor}>
              Next →
            </button>
          </div>
        </>
      )}

      <SubmitBusinessModal open={openSubmit} onClose={() => setOpenSubmit(false)} />
    </div>
  );
}
