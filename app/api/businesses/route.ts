// PATCH 2/2: app/api/businesses/route.ts
// - Longer cache in FREE mode + safer rate limit knobs.

import { NextRequest, NextResponse } from 'next/server';
import { getEnvNumber, Provider, ProviderClient, ProviderResult, SearchInput } from '@/lib/providers/base';
import { GooglePlacesProvider } from '@/lib/providers/googlePlaces';
import { YelpProvider } from '@/lib/providers/yelp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEF_LAT = getEnvNumber(process.env.CITY_DEFAULT_LAT, 40.7608);
const DEF_LNG = getEnvNumber(process.env.CITY_DEFAULT_LNG, -111.8910);
const DEF_RADIUS = getEnvNumber(process.env.CITY_RADIUS_M, 15000);

function getProvider(): { name: Provider; client: ProviderClient; missingKey: boolean } {
  const p = (process.env.BUSINESS_PROVIDER || 'google').toLowerCase() as Provider;
  if (p === 'yelp') {
    const key = process.env.YELP_API_KEY || '';
    return { name: 'yelp', client: new YelpProvider(key), missingKey: !key };
    }
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  return { name: 'google', client: new GooglePlacesProvider(key), missingKey: !key };
}

// --- FREE MODE / CACHE / RATE ---
const FREE_MODE = process.env.BUSINESS_FREE_MODE === '1';
const RATE = getEnvNumber(process.env.BUSINESS_RATE_PER_MIN, FREE_MODE ? 30 : 60);       // tokens/min
const CACHE_TTL_MS = getEnvNumber(process.env.BUSINESS_CACHE_TTL_MS, FREE_MODE ? 86_400_000 : 3_600_000); // 24h vs 1h
const MAX_CACHE = getEnvNumber(process.env.BUSINESS_CACHE_MAX, FREE_MODE ? 300 : 200);

type Bucket = { tokens: number; updated: number };
const buckets = new Map<string, Bucket>();
function allow(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: RATE, updated: now };
  const elapsed = now - b.updated;
  if (elapsed > 0) {
    const refill = Math.floor((elapsed / 60_000) * RATE);
    if (refill > 0) { b.tokens = Math.min(RATE, b.tokens + refill); b.updated = now; }
  }
  if (b.tokens <= 0) { buckets.set(ip, b); return false; }
  b.tokens -= 1; buckets.set(ip, b); return true;
}

type CacheEntry = { value: ProviderResult & { tookMs: number }, expiresAt: number };
const CACHE = new Map<string, CacheEntry>();

function cacheGet(key: string) {
  const e = CACHE.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { CACHE.delete(key); return null; }
  CACHE.delete(key); CACHE.set(key, e); return e.value;
}
function cacheSet(key: string, value: CacheEntry['value']) {
  if (CACHE.size >= MAX_CACHE) { const first = CACHE.keys().next().value; if (first) CACHE.delete(first); }
  CACHE.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const { name: providerName, client, missingKey } = getProvider();

  const ip = (req.ip || req.headers.get('x-forwarded-for') || 'anon').toString().split(',')[0].trim();
  if (!allow(ip)) {
    return NextResponse.json({ items: [], nextCursor: null, provider: providerName, tookMs: 0, error: 'rate_limited' }, { status: 429 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const category = url.searchParams.get('category');
  const lat = Number(url.searchParams.get('lat') || DEF_LAT);
  const lng = Number(url.searchParams.get('lng') || DEF_LNG);
  const radius = Number(url.searchParams.get('radius') || DEF_RADIUS);
  const page = url.searchParams.get('page');

  const input: SearchInput = { q, category, lat, lng, radius, page };

  const key = JSON.stringify({ providerName, ...input });
  const cached = cacheGet(key);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, {
      headers: { 'Cache-Control': `s-maxage=${Math.floor(CACHE_TTL_MS/1000)}, stale-while-revalidate=3600` },
    });
  }

  if (missingKey) {
    const tookMs = Date.now() - t0;
    const empty = { items: [], nextCursor: null, provider: providerName, tookMs };
    cacheSet(key, empty);
    return NextResponse.json(empty, { headers: { 'x-missing-keys': 'true' } });
  }

  try {
    const result = await client.searchBusinesses(input);
    const tookMs = Date.now() - t0;
    const payload = { ...result, tookMs };
    cacheSet(key, payload);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': `s-maxage=${Math.floor(CACHE_TTL_MS/1000)}, stale-while-revalidate=3600` },
    });
  } catch {
    const tookMs = Date.now() - t0;
    return NextResponse.json({ items: [], nextCursor: null, provider: providerName, tookMs, error: 'upstream_error' }, { status: 200 });
  }
}
