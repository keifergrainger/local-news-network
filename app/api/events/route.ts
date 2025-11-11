import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

/** Ensure env vars (like TICKETMASTER_KEY) are available */
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
// Ticketmaster hates milliseconds. Use YYYY-MM-DDTHH:MM:SSZ
const toTmISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

const SALES_NEGATIVE = [
  "sale","sales","percent off","% off","off%","discount","deal","deals",
  "bogo","clearance","coupon","promo","promotion","grand opening",
  "blowout","doorbuster","black friday","cyber monday"
];
const isRetailish = (t = "") => SALES_NEGATIVE.some(w => t.toLowerCase().includes(w));

const dedupe = (events: RawEvent[]) => {
  const seen = new Set<string>();
  return events.filter(e => {
    const k = `${(e.title||"").toLowerCase()}|${e.start}|${(e.venue||"").toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/* ---------- ICS parsing (robust to folded lines, CRLF, TZ variants) ---------- */
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

/* ---------- Ticketmaster helpers (two strategies) ---------- */
async function tmFetch(url: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const status = r.status;
    const text = await r.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON error */ }

    const events = (data?._embedded?.events || []).map((ev: any) => {
      const whenRaw = ev.dates?.start?.dateTime || ev.dates?.start?.localDate; // localDate fallback
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

    return {
      status,
      total: data?.page?.totalElements ?? events.length,
      events,
      rawText: status !== 200 ? text : undefined
    };
  } catch (e) {
    return { status: 0, total: 0, events: [], rawText: String(e) };
  }
}

function clampRange(from: Date, to: Date, maxDays = 180) {
  const maxTo = new Date(from.getTime() + maxDays * DAY_MS);
  return to.getTime() > maxTo.getTime() ? maxTo : to;
}

async function fetchTicketmasterBothWays(
  cityName: string,
  lat: number,
  lon: number,
  from: Date,
  to: Date,
  radiusMiles = 25
) {
  const key = process.env.TICKETMASTER_KEY;
  if (!key) return { chosen: "none", status: 0, total: 0, events: [], urls: {}, rawText: "no key" };

  // City mode — NO radius, NO locale, NO milliseconds
  const qsCity = new URLSearchParams({
    apikey: key,
    city: cityName,
    sort: "date,asc",
    startDateTime: toTmISO(from),
    endDateTime: toTmISO(to),
    size: "200",
  });
  const urlCity = `https://app.ticketmaster.com/discovery/v2/events.json?${qsCity.toString()}`;

  // Lat/long mode — WITH radius, NO locale, NO milliseconds
  const qsLat = new URLSearchParams({
    apikey: key,
    latlong: `${lat},${lon}`,
    radius: String(radiusMiles),
    unit: "miles",
    sort: "date,asc",
    startDateTime: toTmISO(from),
    endDateTime: toTmISO(to),
    size: "200",
  });
  const urlLat = `https://app.ticketmaster.com/discovery/v2/events.json?${qsLat.toString()}`;

  // Try lat/long first, fallback to city name
  const a = await tmFetch(urlLat);
  if (a.total > 0 && a.status === 200) {
    return { chosen: "latlong", status: a.status, total: a.total, events: a.events, urls: { urlLat, urlCity }, rawText: a.rawText };
  }
  const b = await tmFetch(urlCity);
  return { chosen: "city", status: b.status, total: b.total, events: b.events, urls: { urlLat, urlCity }, rawText: b.rawText };
}

/* ---------------- API Handler ---------------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cityHost = (url.searchParams.get("cityHost") || "").toLowerCase();
    const rawHost  = (url.searchParams.get("host") || "").toLowerCase();
    const debug    = url.searchParams.get("debug") === "1";

    // Date range (clamped to 180 days for TM)
    const fromParam = url.searchParams.get("from");
    const toParam   = url.searchParams.get("to");
    const rangeFrom = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * DAY_MS);
    const unclampedTo = toParam ? new Date(toParam) : new Date(Date.now() + 120 * DAY_MS);
    const rangeTo   = clampRange(rangeFrom, unclampedTo, 180);

    const city =
      CITIES.find(c => cityHost && cityHost.includes(c.host)) ||
      CITIES.find(c => rawHost && rawHost.includes(c.host)) ||
      CITIES[0];

    // Fetch ICS + Ticketmaster
    const [icsArrays, tm] = await Promise.all([
      Promise.all((city.icsFeeds || []).map(u => fetchICS(u))),
      fetchTicketmasterBothWays(city.city, city.lat, city.lon, rangeFrom, rangeTo, city.eventRadiusMiles ?? 25),
    ]);
    const ics = icsArrays.flat();

    // Merge (NO extra date re-filter — trust TM range), still remove retail
    const merged = [...ics, ...tm.events]
      .filter(e => !!e.start)
      .filter(e => !isRetailish(e.title || ""));

    const events = dedupe(merged)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 300);

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
      payload.tmUrls = tm.urls;
      if (tm.status !== 200) payload.tmError = tm.rawText;
    }

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
