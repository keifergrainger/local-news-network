export type EventItem = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  url?: string;
  venue?: string;
  address?: string;
  lat?: number;
  lng?: number;
  source: "ticketmaster" | "ics";
};

type TMOptions = {
  lat: number;
  lng: number;
  radiusMiles: number;
  startISO: string;
  endISO: string;
  city?: string;
  state?: string; // 2-letter
};

type AttemptInfo = {
  label: string;
  params: Record<string, string>;
  status?: number;
  pages?: number;
  count: number;
  error?: string;
};

function isoOrNull(s?: string | null) {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

function mapEvents(arr: any[]): EventItem[] {
  return arr.map((e) => {
    const v = e?._embedded?.venues?.[0] || {};
    const city = v?.city?.name ? ` ${v.city.name}` : "";
    const state = v?.state?.stateCode ? `, ${v.state.stateCode}` : "";
    const addr = v?.address?.line1 ? `${v.address.line1}${city}${state}` : (v?.name || "").trim();

    const loc = v?.location || {};
    const startISO = e?.dates?.start?.dateTime ||
      (e?.dates?.start?.localDate ? `${e.dates.start.localDate}T${e?.dates?.start?.localTime || "00:00:00"}` : undefined);
    const endISO   = e?.dates?.end?.dateTime || undefined;

    return {
      id: String(e.id || e.url || Math.random()),
      title: String(e.name || "Event"),
      start: isoOrNull(startISO),
      end: isoOrNull(endISO),
      url: e.url || undefined,
      venue: v?.name || undefined,
      address: addr || undefined,
      lat: loc?.latitude ? Number(loc.latitude) : undefined,
      lng: loc?.longitude ? Number(loc.longitude) : undefined,
      source: "ticketmaster" as const,
    };
  });
}

async function fetchPaged(base: URL): Promise<{ items: EventItem[]; status?: number; pages: number }> {
  let page = 0;
  const size = Number(base.searchParams.get("size") || 100);
  let items: EventItem[] = [];
  let status: number | undefined;
  let totalPages = 1;

  for (; page < 5; page++) { // hard cap: 5 pages
    base.searchParams.set("page", String(page));
    const r = await fetch(base.toString(), { cache: "no-store" });
    status = r.status;
    if (!r.ok) break;
    const j: any = await r.json();
    const arr: any[] = j?._embedded?.events || [];
    items = items.concat(mapEvents(arr));
    const info = j?.page;
    if (info && typeof info.totalPages === "number") totalPages = info.totalPages;
    if (page + 1 >= totalPages) break;
  }
  return { items, status, pages: page + 1 };
}

/**
 * Try multiple strategies:
 *  A) lat/long + radius + date range
 *  B) lat/long + radius (no date filter)
 *  C) city+state + date range
 *  D) city+state (no date)
 */
export async function fetchTicketmaster(opts: TMOptions, apiKey: string):
  Promise<{ items: EventItem[]; attempts: AttemptInfo[] }> {

  const attempts: AttemptInfo[] = [];
  const common = {
    apikey: apiKey,
    locale: "*",
    unit: "miles",
    size: "100",
    sort: "date,asc",
  } as const;

  const build = (label: string, params: Record<string, string>) => {
    const u = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    u.searchParams.set("apikey", common.apikey);
    u.searchParams.set("locale", common.locale);
    u.searchParams.set("size", common.size);
    u.searchParams.set("sort", common.sort);
    u.searchParams.set("unit", common.unit);
    Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
    return { label, url: u, params };
  };

  const tries = [
    build("A: latlong+radius+date", {
      latlong: `${opts.lat},${opts.lng}`,
      radius: String(Math.max(1, Math.round(opts.radiusMiles))),
      startDateTime: new Date(opts.startISO).toISOString(),
      endDateTime: new Date(opts.endISO).toISOString(),
    }),
    build("B: latlong+radius (no date)", {
      latlong: `${opts.lat},${opts.lng}`,
      radius: String(Math.max(1, Math.round(opts.radiusMiles))),
    }),
  ];

  if (opts.city && opts.state) {
    tries.push(
      build("C: city+state+date", {
        city: opts.city,
        stateCode: opts.state,
        startDateTime: new Date(opts.startISO).toISOString(),
        endDateTime: new Date(opts.endISO).toISOString(),
      }),
      build("D: city+state (no date)", {
        city: opts.city,
        stateCode: opts.state,
      })
    );
  }

  const collected: EventItem[] = [];
  for (const t of tries) {
    try {
      const { items, status, pages } = await fetchPaged(t.url);
      attempts.push({ label: t.label, params: t.params, status, pages, count: items.length });
      if (items.length) collected.push(...items);
      // If we already found a decent set, we can stop early
      if (collected.length >= 50) break;
    } catch (e: any) {
      attempts.push({ label: t.label, params: t.params, count: 0, error: String(e?.message || e) });
    }
  }

  // dedupe by title+date
  const seen = new Map<string, EventItem>();
  for (const e of collected) {
    const k = `${(e.title||"").toLowerCase().trim()}|${(e.start||"").slice(0,10)}`;
    if (!seen.has(k)) seen.set(k, e);
  }

  return { items: Array.from(seen.values()), attempts };
}
