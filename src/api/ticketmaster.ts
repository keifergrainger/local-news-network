import type { EventItem } from "../types/EventItem";

type TMEvent = any;

const stripMillis = (iso: string): string => {
  // Replace "...:ss.mmmZ" with "...:ssZ"
  return iso.replace(/\.\d{3}Z$/, "Z");
};

const monthRangeUTC = (year: number, month1to12: number) => {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0));
  // day=0 of next month = last day of current month
  const end = new Date(Date.UTC(year, month1to12, 0, 23, 59, 59));
  return { start, end };
};

const buildUrl = (base: string, params: Record<string, string>) => {
  const usp = new URLSearchParams();
  Object.keys(params).forEach((k) => {
    const v = params[k];
    if (v != null) usp.set(k, v);
  });
  return base + "?" + usp.toString();
};

const mapTMEventToItem = (e: TMEvent): EventItem | null => {
  if (!e || !e.id || !e.name) return null;

  let startISO: string | undefined = e.dates?.start?.dateTime;
  if (!startISO && e.dates?.start?.localDate) {
    // Fallback if only a date is provided (interpret as midnight UTC)
    startISO = e.dates.start.localDate + "T00:00:00Z";
  }
  if (!startISO) return null;

  const endISO: string | undefined = e.dates?.end?.dateTime;

  const v = e._embedded?.venues?.[0];
  const venueName: string | undefined = v?.name;
  const addressParts: string[] = [];
  if (v?.address?.line1) addressParts.push(v.address.line1);
  if (v?.city?.name) addressParts.push(v.city.name);
  if (v?.state?.stateCode) addressParts.push(v.state.stateCode);
  const address = addressParts.join(", ");

  let lat: number | undefined = undefined;
  let lng: number | undefined = undefined;
  if (v?.location?.latitude && v?.location?.longitude) {
    const plat = parseFloat(v.location.latitude as string);
    const plng = parseFloat(v.location.longitude as string);
    if (isFinite(plat)) lat = plat;
    if (isFinite(plng)) lng = plng;
  }

  return {
    id: e.id,
    title: e.name,
    start: startISO,
    end: endISO,
    venue: venueName,
    address,
    lat,
    lng,
    url: e.url,
    source: "ticketmaster"
  };
};

export interface FetchTMOptions {
  apiKey: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  startISO?: string; // optional date range
  endISO?: string;
  maxPages?: number; // safety (default 10)
}

export async function fetchTicketmasterEvents(opts: FetchTMOptions): Promise<EventItem[]> {
  const base = "https://app.ticketmaster.com/discovery/v2/events.json";
  const maxPages = typeof opts.maxPages === "number" && opts.maxPages > 0 ? opts.maxPages : 10;

  const commonParams: Record<string, string> = {
    apikey: opts.apiKey,
    latlong: opts.lat.toString() + "," + opts.lng.toString(),
    radius: String(opts.radiusMiles),
    unit: "miles",
    size: "200",
    sort: "date,asc"
  };

  if (opts.startISO && opts.endISO) {
    commonParams.startDateTime = stripMillis(opts.startISO);
    commonParams.endDateTime = stripMillis(opts.endISO);
  }

  // First page
  let url = buildUrl(base, commonParams);
  let page = 0;
  const all: EventItem[] = [];

  while (page < maxPages) {
    const urlWithPage = url + "&page=" + page.toString();
    const res = await fetch(urlWithPage);
    if (!res.ok) {
      // Bail out if TM complains (e.g., 400 on bad date params)
      break;
    }
    const data = await res.json();

    const embedded = data?._embedded;
    const events: TMEvent[] = embedded?.events || [];
    for (const e of events) {
      const mapped = mapTMEventToItem(e);
      if (mapped) all.push(mapped);
    }

    const pageInfo = data?.page;
    const totalPages = pageInfo?.totalPages ?? 1;
    page++;
    if (page >= totalPages) break;
  }

  return all;
}

export async function fetchTicketmasterEventsByMonth(apiKey: string, lat: number, lng: number, radiusMiles: number, year: number, month1to12: number): Promise<EventItem[]> {
  const rng = monthRangeUTC(year, month1to12);
  return fetchTicketmasterEvents({
    apiKey,
    lat,
    lng,
    radiusMiles,
    startISO: rng.start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    endISO: rng.end.toISOString().replace(/\.\d{3}Z$/, "Z"),
    maxPages: 10
  });
}
