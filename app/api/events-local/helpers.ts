import { getCityFromHost } from "@/lib/cities";
import type { CityConfig } from "@/lib/cities";
import { loadEvents, safeDate, type EventItem } from "../_events-util";

export type NormalizedEvent = {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  venue?: string | null;
  address?: string | null;
  url?: string | null;
  source?: string | null;
  free?: boolean | null;
  lat?: number | null;
  lng?: number | null;
};

export type FilteredEventsResult = {
  city: CityConfig;
  center: { lat: number; lng: number; radiusMiles: number };
  range: { from?: Date | null; to?: Date | null };
  events: NormalizedEvent[];
};

const EARTH_RADIUS_MI = 3958.8;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MI * c;
}

function parseNumberParam(raw?: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseRadiusMiles(url: URL, fallback: number): number {
  const radiusMilesParam = parseNumberParam(url.searchParams.get("radiusMiles"));
  if (radiusMilesParam && radiusMilesParam > 0) return radiusMilesParam;

  const radiusRaw = parseNumberParam(url.searchParams.get("radius"));
  if (radiusRaw && radiusRaw > 0) {
    // Heuristic: if the value looks like meters (> 500), convert; otherwise assume miles.
    return radiusRaw > 500 ? radiusRaw / 1609.344 : radiusRaw;
  }

  return fallback;
}

function normalizeEvent(event: EventItem, idx: number): NormalizedEvent | null {
  const title = event?.title?.trim();
  const startDate = safeDate(event?.start);
  if (!title || !startDate) return null;

  const endDate = safeDate(event?.end ?? undefined);
  const latRaw = (event as any)?.lat;
  const lngRaw = (event as any)?.lng;
  const lat = typeof latRaw === "number" ? latRaw : parseNumberParam(typeof latRaw === "string" ? latRaw : undefined);
  const lng = typeof lngRaw === "number" ? lngRaw : parseNumberParam(typeof lngRaw === "string" ? lngRaw : undefined);

  let address: string | null = event?.address ?? null;
  if (!address) {
    const city = (event as any)?.city;
    const state = (event as any)?.state;
    if (city) address = state ? `${city}, ${state}` : String(city);
  }

  return {
    id: String(event?.id ?? `event-${idx}`),
    title,
    start: startDate.toISOString(),
    end: endDate ? endDate.toISOString() : null,
    venue: event?.venue ?? null,
    address,
    url: event?.url ?? null,
    source: event?.source ?? null,
    free: typeof (event as any)?.free === "boolean" ? (event as any).free : null,
    lat: lat ?? null,
    lng: lng ?? null,
  };
}

export async function loadFilteredEvents(url: URL): Promise<FilteredEventsResult> {
  const hostParam = url.searchParams.get("cityHost") || url.searchParams.get("host") || url.hostname;
  const city = getCityFromHost(hostParam || undefined);

  const latParam = parseNumberParam(url.searchParams.get("lat"));
  const lngParam = parseNumberParam(url.searchParams.get("lng"));
  const centerLat = latParam ?? city.lat;
  const cityLng = (city as unknown as { lng?: number }).lng ?? (city as unknown as { lon?: number }).lon ?? city.lon;
  const centerLng = lngParam ?? cityLng;

  const radiusMiles = parseRadiusMiles(url, city.eventRadiusMiles ?? 25);

  const fromParam = url.searchParams.get("start") || url.searchParams.get("from");
  const toParam = url.searchParams.get("end") || url.searchParams.get("to");
  const from = fromParam ? safeDate(fromParam) : null;
  const to = toParam ? safeDate(toParam) : null;

  const startMs = from ? from.getTime() : Number.NEGATIVE_INFINITY;
  const endMs = to ? to.getTime() : Number.POSITIVE_INFINITY;

  const rawEvents = await loadEvents();
  const normalized: NormalizedEvent[] = [];

  rawEvents.forEach((ev, idx) => {
    const mapped = normalizeEvent(ev, idx);
    if (!mapped) return;
    const eventTime = new Date(mapped.start).getTime();
    if (eventTime < startMs || eventTime > endMs) return;

    if (mapped.lat != null && mapped.lng != null) {
      const distance = haversineMiles(centerLat, centerLng, mapped.lat, mapped.lng);
      if (distance > radiusMiles) return;
    }

    normalized.push(mapped);
  });

  normalized.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    city,
    center: { lat: centerLat, lng: centerLng, radiusMiles },
    range: { from, to },
    events: normalized,
  };
}
