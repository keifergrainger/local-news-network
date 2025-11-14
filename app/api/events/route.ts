export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { CITIES, getCityFromHost } from "@/lib/cities";
import { fetchTicketmaster } from "@/lib/providers/ticketmaster";
import { loadEvents, deriveRangeFromQuery, safeDate } from "../_events-util";

type CalendarEvent = {
  id?: string;
  title?: string;
  start?: string;
  end?: string | null;
  url?: string | null;
  venue?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string | null;
  free?: boolean | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function normalize(s?: string | null) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dedupeEvents(events: CalendarEvent[]) {
  const seen = new Map<string, CalendarEvent>();
  for (const ev of events) {
    if (!ev?.title || !ev?.start) continue;
    const start = safeDate(ev.start);
    if (!start) continue;
    const keyBase = `${normalize(ev.title)}|${ymd(start)}`;
    const loc = normalize(ev.venue || ev.address);
    const key = loc ? `${keyBase}|${loc}` : keyBase;

    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, ev);
      continue;
    }

    const prevTime = prev.start ? +new Date(prev.start) : Infinity;
    const nextTime = +start;
    if (nextTime < prevTime) seen.set(key, ev);
  }
  return Array.from(seen.values());
}

function clampRange(start: Date, end: Date) {
  const maxDays = 62; // ~2 months window
  const span = end.getTime() - start.getTime();
  if (span <= maxDays * DAY_MS) return { start, end };
  const clampedEnd = new Date(start.getTime() + maxDays * DAY_MS);
  return { start, end: clampedEnd };
}

function stripMillis(iso: string) {
  return iso.replace(/\.\d{3}Z$/, "Z");
}

function parseICSDate(raw?: string | null) {
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
  }
  if (/Z$/.test(raw)) {
    const iso = new Date(raw).toISOString();
    if (!Number.isNaN(Date.parse(iso))) return iso;
  }
  if (/^\d{8}T\d{6}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const hh = raw.slice(9, 11);
    const mm = raw.slice(11, 13);
    const ss = raw.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`).toISOString();
  }
  const iso = new Date(raw).toISOString();
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

async function fetchICSFeed(url: string): Promise<CalendarEvent[]> {
  try {
    const raw = await fetch(url, { cache: "no-store" }).then((r) => r.text());
    const blocks = raw.split("BEGIN:VEVENT").slice(1);
    const out: CalendarEvent[] = [];
    for (const block of blocks) {
      const grab = (field: string) => {
        const match = block.match(new RegExp(`${field}(?:;[^:]+)?:([^\\r\\n]+)`, "i"));
        return match?.[1]?.trim();
      };
      const title = grab("SUMMARY");
      const startRaw = grab("DTSTART");
      if (!title || !startRaw) continue;
      const start = parseICSDate(startRaw);
      if (!start) continue;
      const endRaw = grab("DTEND");
      const end = endRaw ? parseICSDate(endRaw) : null;
      const location = grab("LOCATION") || undefined;
      const urlField = grab("URL") || undefined;
      out.push({
        id: `ics:${start}:${title}`,
        title,
        start,
        end,
        address: location,
        venue: location,
        url: urlField,
        source: "ICS",
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchEventbriteRange(
  cityName: string,
  terms: string[] | undefined,
  start: Date,
  end: Date,
): Promise<CalendarEvent[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) return [];

  const queries = terms && terms.length ? terms.slice(0, 5) : [cityName];
  const padStart = new Date(start.getTime() - DAY_MS).toISOString();
  const padEnd = new Date(end.getTime() + DAY_MS).toISOString();

  const events: CalendarEvent[] = [];

  for (const q of queries) {
    try {
      const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
      url.searchParams.set("q", q);
      url.searchParams.set("sort_by", "date");
      url.searchParams.set("expand", "venue");
      url.searchParams.set("start_date.range_start", padStart);
      url.searchParams.set("start_date.range_end", padEnd);
      url.searchParams.set("include_all_series_instances", "true");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const data = await res.json();
      const list: any[] = Array.isArray(data?.events) ? data.events : [];

      for (const ev of list) {
        const iso = ev?.start?.utc ? new Date(ev.start.utc).toISOString() : null;
        if (!iso) continue;
        const when = safeDate(iso);
        if (!when || when < start || when > end) continue;

        const venueName = ev?.venue?.name || undefined;
        const addr =
          ev?.venue?.address?.localized_address_display ||
          ev?.venue?.address?.localized_area_display ||
          undefined;

        events.push({
          id: ev?.id ? `eb:${ev.id}` : undefined,
          title: ev?.name?.text || "Untitled",
          start: iso,
          end: ev?.end?.utc ? new Date(ev.end.utc).toISOString() : null,
          venue: venueName,
          address: addr,
          url: ev?.url || undefined,
          source: "Eventbrite",
          free: ev?.is_free ?? null,
        });
      }
    } catch {
      // ignore individual query failures
    }
  }

  return events;
}

async function fetchTicketmasterRange(cityCfg: (typeof CITIES)[number], start: Date, end: Date) {
  const apiKey = process.env.TICKETMASTER_KEY;
  if (!apiKey) return [] as CalendarEvent[];

  const { items } = await fetchTicketmaster(
    {
      lat: cityCfg.lat,
      lng: cityCfg.lon,
      radiusMiles: cityCfg.eventRadiusMiles ?? 25,
      startISO: stripMillis(start.toISOString()),
      endISO: stripMillis(end.toISOString()),
      city: cityCfg.city,
      state: cityCfg.state,
    },
    apiKey,
  );

  return items.map((ev) => ({
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end ?? null,
    url: ev.url ?? null,
    venue: ev.venue,
    address: ev.address,
    lat: ev.lat ?? null,
    lng: ev.lng ?? null,
    source: "Ticketmaster",
  } satisfies CalendarEvent));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { start: rawStart, end: rawEnd } = deriveRangeFromQuery(url);
    const { start, end } = clampRange(rawStart, rawEnd);

    const hostParam = url.searchParams.get("host") || url.searchParams.get("cityHost") || "";
    const headerHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const city = getCityFromHost(hostParam || headerHost);

    const [localEvents, tmEvents, icsEvents, ebEvents] = await Promise.all([
      loadEvents().then((events) => dedupeEvents(events as CalendarEvent[])),
      fetchTicketmasterRange(city, start, end),
      Promise.all((city.icsFeeds || []).map((feed) => fetchICSFeed(feed))).then((parts) => parts.flat()),
      fetchEventbriteRange(city.city, city.eventbriteTerms, start, end),
    ]);

    const combined = dedupeEvents([
      ...localEvents,
      ...tmEvents,
      ...icsEvents,
      ...ebEvents,
    ]);

    const filtered = combined
      .filter((ev) => {
        if (!ev?.start) return false;
        const when = safeDate(ev.start);
        return !!when && when >= start && when <= end;
      })
      .sort((a, b) => {
        const ta = a.start ? Date.parse(a.start) : 0;
        const tb = b.start ? Date.parse(b.start) : 0;
        return ta - tb;
      });

    return NextResponse.json({
      events: filtered,
      from: start.toISOString(),
      to: end.toISOString(),
      count: filtered.length,
      city: {
        host: city.host,
        name: `${city.city}, ${city.state}`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ events: [], error: String(err?.message ?? err) });
  }
}
