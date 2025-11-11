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
const toTmISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z"); // TM dislikes millis

const SALES_NEGATIVE = [
  "sale","sales","percent off","% off","off%","discount","deal","deals",
  "bogo","clearance","coupon","promo","promotion","grand opening",
  "blowout","doorbuster","black friday","cyber monday","two for one",
  "kids eat free","happy hour"
];
const isRetailish = (t = "") => SALES_NEGATIVE.some(w => t.toLowerCase().includes(w));

/** Base normalization */
function normalizeTitle(t = "") {
  return t
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s+vs\.\s+/g, " vs ")
    .replace(/\s+vs\s+/g, " vs ")
    .replace(/\s+at\s+/g, " at ")
    .replace(/[’'"]/g, "")
    .replace(/[.,!?:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Try to canonicalize sports matchups so "A vs B" === "B at A" */
function sportsKey(title = ""): string | null {
  const t = normalizeTitle(title);
  const m = t.match(/(.+?)\s+(?:vs|at)\s+(.+)/i);
  if (!m) return null;
  const a = m[1].trim();
  const b = m[2].trim();
  const parts = [a, b].sort((x, y) => x.localeCompare(y));
  return `sports:${parts[0]}__${parts[1]}`;
}

/** Token Jaccard (for 90% near-duplicate collapsing) */
const STOP = new Set([
  "the","a","an","and","of","in","at","on","for","with","to","from","by",
  "live","tour","show","concert","game","match","vs","at","night","festival",
  "dj","band","orchestra","symphony","present","presents"
]);
function tokenize(t = ""): Set<string> {
  const s = normalizeTitle(t).replace(/[^a-z0-9\s]/g, " ");
  const tok = s.split(/\s+/).filter(w => w && !STOP.has(w) && w.length > 2);
  return new Set(tok);
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}
function nearDuplicateTitle(a: string, b: string, threshold = 0.9): boolean {
  const A = tokenize(a);
  const B = tokenize(b);
  return jaccard(A, B) >= threshold;
}

/** YYYY-MM-DD in local time from ISO */
function dayKeyLocal(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Same-day dedupe with sportsKey + 90% fuzzy title */
function dedupeDaywise(events: RawEvent[]) {
  const buckets = new Map<string, RawEvent[]>(); // day -> kept list
  for (const ev of events) {
    if (!ev.start || !ev.title) continue;
    const day = dayKeyLocal(ev.start);
    const list = buckets.get(day) || [];
    const skey = sportsKey(ev.title);

    let merged = false;
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const curS = sportsKey(cur.title);
      const sportsMatch = skey && curS && skey === curS;
      const fuzzyMatch = nearDuplicateTitle(cur.title, ev.title, 0.9);

      if (sportsMatch || fuzzyMatch) {
        // keep earliest start
        if (new Date(ev.start).getTime() < new Date(cur.start).getTime()) {
          list[i] = ev;
        }
        merged = true;
        break;
      }
    }
    if (!merged) list.push(ev);
    buckets.set(day, list);
  }
  return Array.from(buckets.values()).flat();
}

// clamp range to maxDays
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

/* ---------- Ticketmaster ---------- */
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

  const size = 200;
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

  const cityParams: Record<string,string> = {
    city: cityName,
    startDateTime: toTmISO(from),
    endDateTime: toTmISO(to),
  };
  const cityRes = await fetchPaginated(cityParams);
  return { chosen: "city", ...cityRes };
}

/* ---------- Eventbrite (optional) ---------- */
async function fetchEventbrite(city: string, from: Date, to: Date, terms: string[] = []): Promise<RawEvent[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) return [];
  const queries = terms.length ? terms.slice(0, 5) : [city];
  const out: RawEvent[] = [];

  for (const q of queries) {
    const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
    url.searchParams.set("q", q);
    url.searchParams.set("sort_by", "date");
    url.searchParams.set("expand", "venue");
    url.searchParams.set("start_date.range_start", from.toISOString());
    url.searchParams.set("start_date.range_end", to.toISOString());
    url.searchParams.set("include_all_series_instances", "true");

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const ev of (data?.events || [])) {
        const dt = ev?.start?.utc;
        if (!dt) continue;
        const loc =
          [ev?.venue?.name, ev?.venue?.address?.localized_address_display].filter(Boolean).join(", ") ||
          ev?.venue?.address?.localized_area_display || undefined;
        out.push({
          id: `eb:${ev?.id}`,
          title: ev?.name?.text || "Untitled",
          start: new Date(dt).toISOString(),
          venue: ev?.venue?.name || undefined,
          address: loc,
          url: ev?.url || undefined,
          source: "Eventbrite"
        });
      }
    } catch { /* ignore */ }
  }
  return out;
}

/* ---------------- API Handler ---------------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cityHost = (url.searchParams.get("cityHost") || "").toLowerCase();
    const rawHost  = (url.searchParams.get("host") || "").toLowerCase();
    const debug    = url.searchParams.get("debug") === "1";
    const full     = url.searchParams.get("full") === "1"; // legacy full

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

    // Fetch ICS + Ticketmaster + Eventbrite
    const [icsArrays, tm, eb] = await Promise.all([
      Promise.all((city.icsFeeds || []).map(u => fetchICS(u))),
      fetchTicketmasterAll(city.city, city.lat, city.lon, rangeFrom, rangeTo, city.eventRadiusMiles ?? 25),
      fetchEventbrite(city.city, rangeFrom, rangeTo, city.eventbriteTerms || []),
    ]);
    const ics = icsArrays.flat();

    // Merge + filter + fuzzy dedupe (per day)
    const merged = [...ics, ...tm.events, ...eb]
      .filter(e => !!e.start && !!e.title)
      .filter(e => !isRetailish(e.title || ""));

    const unique = dedupeDaywise(merged);

    const events = unique
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 3000); // generous cap

    // ---------- SUMMARY MODE (default) ----------
    if (!full) {
      // Priority classifiers
      const isSports = (t = "") =>
        /\b(vs\.?|game|match|basketball|football|hockey|soccer|baseball|nba|nfl|nhl|mls|ncaa|arena|stadium|center)\b/i.test(t);
      const isConcert = (t = "") =>
        /\b(concert|live|tour|orchestra|symphony|band|dj|music|festival)\b/i.test(t);

      const sortByStart = (a: RawEvent, b: RawEvent) =>
        new Date(a.start).getTime() - new Date(b.start).getTime();

      // Bucket by day
      const buckets = new Map<string, RawEvent[]>();
      for (const ev of events) {
        const k = dayKeyLocal(ev.start);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k)!.push(ev);
      }

      // Build per-day summary from already-deduped lists
      const days = Array.from(buckets.entries())
        .map(([date, arr]) => {
          const sorted = [...arr].sort(sortByStart);
          const priority = sorted.filter(e => isSports(e.title) || isConcert(e.title));
          let tops: RawEvent[];

          if (priority.length >= 2) {
            tops = priority.slice(0, 2);
          } else if (priority.length === 1) {
            tops = priority.slice(0, 1);
          } else {
            tops = sorted.slice(0, 1);
          }

          const moreCount = Math.max(0, sorted.length - tops.length);
          return { date, tops, moreCount };
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
        payload.ebEnabled = !!process.env.EVENTBRITE_TOKEN;
      }
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" }
      });
    }

    // ---------- FULL MODE (legacy, if you call ?full=1) ----------
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
      payload.ebEnabled = !!process.env.EVENTBRITE_TOKEN;
    }
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" }
    });

  } catch (e) {
    return NextResponse.json({ days: [] }, { status: 200 });
  }
}
