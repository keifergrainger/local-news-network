import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- Types ---------------- */
type RawEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
  free?: boolean;
};

/* ---------------- Helpers ---------------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const toISO = (d: Date) => new Date(d).toISOString();
// Ticketmaster needs no milliseconds in ISO
const toTmISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

const SALES_NEGATIVE = [
  "sale","sales","percent off","% off","off%","discount","deal","deals",
  "bogo","clearance","coupon","promo","promotion","grand opening",
  "blowout","doorbuster","black friday","cyber monday"
];
const isRetailish = (t = "") => SALES_NEGATIVE.some(w => t.toLowerCase().includes(w));

/** Normalize titles so tiny differences don't bypass dedupe */
function normalizeTitle(t = "") {
  return t
    .toLowerCase()
    .replace(/\s+vs\.\s+/g, " vs ")
    .replace(/[’'"]/g, "")
    .replace(/[.,!?:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** YYYY-MM-DD in local time (based on the event date string) */
function dayKeyLocal(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Same-day dedupe: for each (day, normalized title) keep the earliest start.
 */
function dedupeSameDay(events: RawEvent[]) {
  const keep = new Map<string, RawEvent>(); // key = `${day}|${normTitle}`
  for (const ev of events) {
    if (!ev.start || !ev.title) continue;
    const key = `${dayKeyLocal(ev.start)}|${normalizeTitle(ev.title)}`;
    const existing = keep.get(key);
    if (!existing) {
      keep.set(key, ev);
    } else {
      const a = new Date(existing.start).getTime();
      const b = new Date(ev.start).getTime();
      if (b < a) keep.set(key, ev);
    }
  }
  return Array.from(keep.values());
}

// allow up to 12 months
function clampRange(from: Date, to: Date, maxDays = 365) {
  const maxTo = new Date(from.getTime() + maxDays * DAY_MS);
  return to.getTime() > maxTo.getTime() ? maxTo : to;
}

/* ---------- ICS parsing ---------- */
function unfoldICS(text: string) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}
function pick(line: string, blob: string) {
  const re = new RegExp(`${line}(?:;[^:]+)?:([^\\r\\n]+)`, "i");
  return re.exec(blob)?.[1]?.trim();
}
function icsToISO(s: string) {
  if (/^\d{8}T\d{6}Z$/.test(s)) return new Date(s).toISOString();
  if (/^\d{8}T\d{6}$/.test(s)) {
    const y=s.slice(0,4), m=s.slice(4,6), d=s.slice(6,8), h=s.slice(9,11), mi=s.slice(11,13), se=s.slice(13,15);
    return new Date(`${y}-${m}-${d}T${h}:${mi}:${se}`).toISOString();
  }
  if (/^\d{8}$/.test(s)) {
    const y=s.slice(0,4), m=s.slice(4,6), d=s.slice(6,8);
    return new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
  }
  return new Date(s).toISOString();
}
async function fetchICS(url: string): Promise<RawEvent[]> {
  try {
    const raw = await fetch(url, { cache: "no-store" }).then(r => r.text());
    const ics = unfoldICS(raw);
    const blocks = ics.split("BEGIN:VEVENT").slice(1);
    const out: RawEvent[] = [];
    for (const b of blocks) {
      const summary = pick("SUMMARY", b);
      const dtstart = pick("DTSTART", b);
      const dtend = pick("DTEND", b);
      if (!summary || !dtstart) continue;
      const location = pick("LOCATION", b);
      const urlmatch = pick("URL", b) || pick("X-ALT-DESC", b);
      const startISO = icsToISO(dtstart);
      const endISO = dtend ? icsToISO(dtend) : undefined;
      out.push({
        id: `ics:${startISO}:${summary}`,
        title: summary,
        start: startISO,
        end: endISO,
        venue: location,
        address: location,
        source: "ICS",
        url: urlmatch
      });
    }
    return out;
  } catch {
    return [];
  }
}

/* ---------- Ticketmaster pagination ---------- */
function mapTmEvents(data: any): RawEvent[] {
  const arr = data?._embedded?.events || [];
  return arr.map((ev: any) => {
    const whenRaw = ev.dates?.start?.dateTime || ev.dates?.start?.localDate;
    const whenISO = whenRaw
      ? (whenRaw.includes("T") ? new Date(whenRaw).toISOString()
                               : new Date(`${whenRaw}T00:00:00`).toISOString())
      : undefined;
    const venue = ev._embedded?.venues?.[0];
    return {
      id: `tm:${ev.id}`,
      title: ev.name,
      start: whenISO!,
      venue: venue?.name,
      address: [venue?.address?.line1, venue?.city?.name].filter(Boolean).join(", "),
      source: "Ticketmaster",
      url: ev.url,
      free: false,
    } as RawEvent;
  }).filter((e: RawEvent) => !!e.start);
}

async function fetchPaginated(baseParams: Record<string,string>, maxPages = 5) {
  const key = process.env.TICKETMASTER_KEY;
  if (!key) return { status: 0, total: 0, events: [] as RawEvent[], pages: 0 };

  const size = 200; // TM max per page
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;
  const all: RawEvent[] = [];
  let lastStatus = 0;

  while (page < totalPages && page < maxPages) {
    const qs = new URLSearchParams({
      apikey: key,
      sort: "date,asc",
      size: String(size),
      ...baseParams,
      page: String(page),
    });
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${qs.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    lastStatus = res.status;

    if (!res.ok) break;

    const data = await res.json().catch(() => ({}));
    const mapped = mapTmEvents(data);
    all.push(...mapped);

    const pg = data?.page || {};
    totalPages = typeof pg.totalPages === "number" ? pg.totalPages : totalPages;
    totalElements = typeof pg.totalElements === "number" ? pg.totalElements : totalElements;

    page += 1;
    if (page < totalPages) await new Promise(r => setTimeout(r, 80));
  }

  return { status: lastStatus, total: totalElements || all.length, events: all, pages: page };
}

async function fetchTicketmasterAll(
  cityName: string,
  lat: number,
  lon: number,
  from: Date,
  to: Date,
  radiusMiles = 25
) {
  // Try lat/long WITH radius first
  const latParams: Record<string,string> = {
    latlong: `${lat},${lon}`,
    radius: String(radiusMiles),
    unit: "miles",
    startDateTime: toTmISO(from),
    endDateTime: toTmISO(to),
  };
  const latRes = await fetchPaginated(latParams);
  if (latRes.status === 200 && latRes.events.length > 0) {
    return { chosen: "latlong", ...latRes };
  }

  // Fallback: city name only
  const cityParams: Record<string,string> = {
    city: cityName,
    startDateTime: toTmISO(from),
    endDateTime: toTmISO(to),
  };
  const cityRes = await fetchPaginated(cityParams);
  return { chosen: "city", ...cityRes };
}

/* ---------------- API Handler ---------------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cityHost = (url.searchParams.get("cityHost") || "").toLowerCase();
    const rawHost  = (url.searchParams.get("host") || "").toLowerCase();
    const debug    = url.searchParams.get("debug") === "1";
    const full     = url.searchParams.get("full") === "1"; // <-- add this

    // Date range (clamp to 12 months)
    const fromParam = url.searchParams.get("from");
    const toParam   = url.searchParams.get("to");
    const rangeFrom = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * DAY_MS);
    const unclamped = toParam   ? new Date(toParam)   : new Date(Date.now() + 365 * DAY_MS);
    const rangeTo   = clampRange(rangeFrom, unclamped, 365);

    const city =
      CITIES.find(c => cityHost && cityHost.includes(c.host)) ||
      CITIES.find(c => rawHost && rawHost.includes(c.host)) ||
      CITIES[0];

    // Fetch ICS + Ticketmaster (paginated)
    const [icsArrays, tm] = await Promise.all([
      Promise.all((city.icsFeeds || []).map(u => fetchICS(u))),
      fetchTicketmasterAll(city.city, city.lat, city.lon, rangeFrom, rangeTo, city.eventRadiusMiles ?? 25),
    ]);
    const ics = icsArrays.flat();

    // Merge (no extra date re-filter), remove retail promos, dedupe same-day
    const merged = [...ics, ...tm.events]
      .filter(e => !!e.start)
      .filter(e => !isRetailish(e.title || ""));

    const unique = dedupeSameDay(merged);

    const events = unique
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 2000); // safety cap

    // --- NEW: Summary response (default) ---
    if (!full) {
      // Bucket by day, keep top, compute counts
      const buckets = new Map<string, RawEvent[]>();
      for (const ev of events) {
        const k = dayKeyLocal(ev.start);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k)!.push(ev);
      }
      const days = Array.from(buckets.entries())
        .map(([date, arr]) => {
          arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          return { date, top: arr[0], moreCount: Math.max(0, arr.length - 1) };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      const payload: any = {
        city: { host: city.host, name: `${city.city}, ${city.state}` },
        from: toISO(rangeFrom),
        to: toISO(rangeTo),
        days
      };
      if (debug) {
        payload.tmKeyPresent = !!process.env.TICKETMASTER_KEY;
        payload.tmChosen = tm.chosen;
        payload.tmStatus = tm.status;
        payload.tmTotal = tm.total;
        payload.tmPages = tm.pages;
      }
      return NextResponse.json(payload, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" } });
    }

    // --- Legacy full response (if you call ?full=1) ---
    const payload: any = {
      city: { host: city.host, name: `${city.city}, ${city.state}` },
      from: toISO(rangeFrom),
      to: toISO(rangeTo),
      count: events.length,
      events
    };
    if (debug) {
      payload.tmKeyPresent = !!process.env.TICKETMASTER_KEY;
      payload.tmChosen = tm.chosen;
      payload.tmStatus = tm.status;
      payload.tmTotal = tm.total;
      payload.tmPages = tm.pages;
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" } });

  } catch (e) {
    return NextResponse.json({ days: [] }, { status: 200 });
  }
}
