import { CITIES, type CityConfig } from "@/lib/cities";
import type { EventItem } from "../_events-util";

export type RawEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
  free?: boolean;
  lat?: number;
  lng?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TM_PAGE_SIZE = 200;
const TM_MAX_PAGES = 5;

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function getTimeZoneOffset(date: Date, timeZone: string) {
  const key = `${timeZone}`;
  let dtf = dtfCache.get(key);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(key, dtf);
  }
  const parts = dtf.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    values[part.type] = part.value;
  }
  const asUTC = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

function parseDateRange(from?: Date | null, to?: Date | null) {
  const now = new Date();
  const start = from ?? now;
  const end = to ?? new Date(start.getTime() + 90 * DAY_MS);
  return { start, end };
}

function toTicketmasterISO(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeTitle(raw = "") {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s+vs\.\s+/g, " vs ")
    .replace(/\s+vs\s+/g, " vs ")
    .replace(/\s+at\s+/g, " at ")
    .replace(/[’'\"]/g, "")
    .replace(/[.,!?:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sportsKey(title = ""): string | null {
  const t = normalizeTitle(title);
  const m = t.match(/(.+?)\s+(?:vs|at)\s+(.+)/i);
  if (!m) return null;
  const a = m[1].trim();
  const b = m[2].trim();
  const parts = [a, b].sort((x, y) => x.localeCompare(y));
  return `sports:${parts[0]}__${parts[1]}`;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "in",
  "at",
  "on",
  "for",
  "with",
  "to",
  "from",
  "by",
  "live",
  "tour",
  "show",
  "concert",
  "game",
  "match",
  "vs",
  "at",
  "night",
  "festival",
  "dj",
  "band",
  "orchestra",
  "symphony",
  "present",
  "presents",
]);

function tokenize(title = "") {
  const cleaned = normalizeTitle(title).replace(/[^a-z0-9\s]/g, " ");
  const tokens = cleaned.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w) && w.length > 2);
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function nearDuplicateTitle(a: string, b: string, thr = 0.9) {
  return jaccard(tokenize(a), tokenize(b)) >= thr;
}

export function dayKeyLocal(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dedupeEvents(events: RawEvent[]) {
  const keep = new Map<string, RawEvent[]>();
  for (const ev of events) {
    if (!ev?.start || !ev?.title) continue;
    const day = dayKeyLocal(ev.start);
    const list = keep.get(day) ?? [];
    const sk = sportsKey(ev.title);
    let merged = false;
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const curSk = sportsKey(cur.title);
      if ((sk && curSk && sk === curSk) || nearDuplicateTitle(cur.title, ev.title, 0.9)) {
        if (new Date(ev.start).getTime() < new Date(cur.start).getTime()) list[i] = ev;
        merged = true;
        break;
      }
    }
    if (!merged) list.push(ev);
    keep.set(day, list);
  }
  return Array.from(keep.values()).flat();
}

export async function fetchTicketmasterEvents(
  city: CityConfig,
  start: Date,
  end: Date,
  radiusMiles: number
): Promise<RawEvent[]> {
  const key = process.env.TICKETMASTER_KEY;
  if (!key) return [];

  const qs = new URLSearchParams({
    apikey: key,
    sort: "date,asc",
    size: String(TM_PAGE_SIZE),
    latlong: `${city.lat},${city.lon}`,
    radius: String(radiusMiles),
    unit: "miles",
    startDateTime: toTicketmasterISO(new Date(start.getTime() - DAY_MS)),
    endDateTime: toTicketmasterISO(new Date(end.getTime() + DAY_MS)),
  });

  const pages: RawEvent[][] = [];

  for (let page = 0; page < TM_MAX_PAGES; page++) {
    qs.set("page", String(page));

    try {
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${qs}`, { cache: "no-store" });
      if (!res.ok) break;
      const data = await res.json().catch(() => ({}));
      const arr: any[] = data?._embedded?.events || [];
      if (!arr.length) break;

      pages.push(
        arr
          .map((ev, idx) => {
            const rawStart = ev?.dates?.start?.dateTime || ev?.dates?.start?.localDate;
            if (!rawStart) return null;
            const startISO = rawStart.includes("T")
              ? new Date(rawStart).toISOString()
              : new Date(`${rawStart}T00:00:00`).toISOString();
            const rawEnd = ev?.dates?.end?.dateTime || undefined;
            const venue = ev?._embedded?.venues?.[0];
            const lat = Number(venue?.location?.latitude);
            const lng = Number(venue?.location?.longitude);
            const event: RawEvent = {
              id: `tm:${ev?.id ?? `${page}-${idx}`}`,
              title: ev?.name ?? "Untitled",
              start: startISO,
              end: rawEnd ? new Date(rawEnd).toISOString() : undefined,
              venue: venue?.name ?? undefined,
              address: [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode]
                .filter(Boolean)
                .join(", ") || undefined,
              url: ev?.url ?? undefined,
              source: "Ticketmaster",
              free: Array.isArray(ev?.priceRanges) ? ev.priceRanges.some((p: any) => Number(p?.min) === 0) : undefined,
              lat: Number.isFinite(lat) ? lat : undefined,
              lng: Number.isFinite(lng) ? lng : undefined,
            };
            return event;
          })
          .filter((x): x is RawEvent => !!x)
          .filter((ev) => {
            const t = new Date(ev.start).getTime();
            return t >= start.getTime() - DAY_MS && t <= end.getTime() + DAY_MS;
          })
      );

      const totalPages = Number(data?.page?.totalPages ?? 0);
      if (!Number.isFinite(totalPages) || page >= totalPages - 1) {
        break;
      }
    } catch {
      break;
    }
  }

  return pages.flat();
}

type IcsProperty = { value: string; params: Record<string, string> };

function parseIcsDate(prop?: IcsProperty): Date | null {
  if (!prop) return null;
  const raw = prop.value?.trim();
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6));
    const day = Number(raw.slice(6, 8));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }
  if (!/^\d{8}T\d{6}Z?$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(9, 11));
  const minute = Number(raw.slice(11, 13));
  const second = Number(raw.slice(13, 15));
  if (raw.endsWith("Z")) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const tz = prop.params?.TZID;
  if (!tz) return naiveUtc;
  const offsetMinutes = getTimeZoneOffset(naiveUtc, tz);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60 * 1000);
}

function unfoldIcsLines(raw: string) {
  const lines = raw.split(/\r?\n/);
  const unfolded: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^[ \t]/.test(line)) {
      if (unfolded.length === 0) continue;
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseIcs(raw: string): RawEvent[] {
  const lines = unfoldIcsLines(raw);
  const events: RawEvent[] = [];
  let current: Record<string, IcsProperty> | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const summary = current.SUMMARY?.value?.trim();
    const start = parseIcsDate(current.DTSTART);
    if (!summary || !start) return;
    const end = parseIcsDate(current.DTEND);
    const location = current.LOCATION?.value?.replace(/\\n/g, ", ")?.trim();
    let url = current.URL?.value?.trim();
    if (!url && current.DESCRIPTION?.value) {
      const match = current.DESCRIPTION.value.match(/https?:[^\\s]+/i);
      if (match) url = match[0];
    }
    events.push({
      id: current.UID?.value || `ics:${start.toISOString()}:${summary}`,
      title: summary,
      start: start.toISOString(),
      end: end ? end.toISOString() : undefined,
      venue: current.LOCATION?.value ? current.LOCATION.value.split(/\\n/)[0]?.trim() || undefined : undefined,
      address: location || undefined,
      url: url || undefined,
      source: "ICS",
    });
  };

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      pushCurrent();
      current = null;
      continue;
    }
    if (!current) continue;
    const [namePart, value = ""] = line.split(":", 2);
    const [nameRaw, ...paramParts] = namePart.split(";");
    const name = nameRaw.toUpperCase();
    const params: Record<string, string> = {};
    for (const part of paramParts) {
      const [k, v] = part.split("=", 2);
      if (k && v) params[k.toUpperCase()] = v;
    }
    current[name] = { value, params };
  }

  return events;
}

export async function fetchIcsEvents(url: string, start: Date, end: Date): Promise<RawEvent[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const raw = await res.text();
    return parseIcs(raw).filter((ev) => {
      const t = new Date(ev.start).getTime();
      return t >= start.getTime() - DAY_MS && t <= end.getTime() + DAY_MS;
    });
  } catch {
    return [];
  }
}

export async function fetchEventbriteEvents(
  city: CityConfig,
  start: Date,
  end: Date
): Promise<RawEvent[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) return [];
  const terms = city.eventbriteTerms && city.eventbriteTerms.length ? city.eventbriteTerms.slice(0, 5) : [city.city];
  const out: RawEvent[] = [];

  for (const term of terms) {
    const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
    url.searchParams.set("q", term);
    url.searchParams.set("sort_by", "date");
    url.searchParams.set("expand", "venue");
    url.searchParams.set("include_all_series_instances", "true");
    url.searchParams.set("start_date.range_start", start.toISOString());
    url.searchParams.set("start_date.range_end", end.toISOString());
    url.searchParams.set("page_size", "50");

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      const items: any[] = data?.events || [];
      for (const ev of items) {
        const dt = ev?.start?.utc;
        if (!dt) continue;
        const iso = new Date(dt).toISOString();
        const venue = ev?.venue;
        const lat = Number(venue?.address?.latitude);
        const lng = Number(venue?.address?.longitude);
        out.push({
          id: `eb:${ev?.id}`,
          title: ev?.name?.text || "Untitled",
          start: iso,
          end: ev?.end?.utc ? new Date(ev.end.utc).toISOString() : undefined,
          venue: venue?.name || undefined,
          address: venue?.address?.localized_address_display || undefined,
          url: ev?.url || undefined,
          source: "Eventbrite",
          free: ev?.is_free ?? undefined,
          lat: Number.isFinite(lat) ? lat : undefined,
          lng: Number.isFinite(lng) ? lng : undefined,
        });
      }
    } catch {
      // ignore errors per term
    }
  }

  return out.filter((ev) => {
    const t = new Date(ev.start).getTime();
    return t >= start.getTime() - DAY_MS && t <= end.getTime() + DAY_MS;
  });
}

export async function loadExternalEvents(
  city: CityConfig,
  from?: Date | null,
  to?: Date | null,
  radiusMiles?: number
): Promise<EventItem[]> {
  const { start, end } = parseDateRange(from, to);
  const radius = radiusMiles ?? city.eventRadiusMiles ?? 25;

  const [tm, icsLists, eb] = await Promise.all([
    fetchTicketmasterEvents(city, start, end, radius),
    Promise.all((city.icsFeeds || []).map((url) => fetchIcsEvents(url, start, end))),
    fetchEventbriteEvents(city, start, end),
  ]);

  const combined = dedupeEvents([...tm, ...icsLists.flat(), ...eb]);

  return combined.map((ev, idx) => ({
    id: ev.id || `external-${idx}`,
    title: ev.title,
    start: ev.start,
    end: ev.end,
    venue: ev.venue,
    address: ev.address,
    url: ev.url,
    source: ev.source,
    free: ev.free,
    lat: ev.lat,
    lng: ev.lng,
  } satisfies EventItem));
}

export function resolveCity(host?: string) {
  const normalized = (host || "").toLowerCase();
  return (
    CITIES.find((c) => normalized.includes(c.host)) ||
    CITIES[0]
  );
}

