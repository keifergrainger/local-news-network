import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

type RawEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  venue?: string;
  address?: string;
  source?: string;
  url?: string;
  free?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const now = () => new Date();
const toISO = (d: Date) => new Date(d).toISOString();

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

// ---- ICS feed fetch ----
async function fetchICS(url: string): Promise<RawEvent[]> {
  try {
    const ics = await fetch(url, { cache: "no-store" }).then(r => r.text());
    const out: RawEvent[] = [];
    const blocks = ics.split("BEGIN:VEVENT").slice(1);
    for (const b of blocks) {
      const summary = /SUMMARY:(.+)/.exec(b)?.[1]?.trim();
      const dtstart = /DTSTART(?:;[^:]+)?:([^\n\r]+)/.exec(b)?.[1]?.trim();
      const dtend = /DTEND(?:;[^:]+)?:([^\n\r]+)/.exec(b)?.[1]?.trim();
      const location = /LOCATION:(.+)/.exec(b)?.[1]?.trim();
      const urlmatch = /URL:(.+)/.exec(b)?.[1]?.trim();
      if (!summary || !dtstart) continue;
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
  } catch { return []; }
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

// ---- Ticketmaster fetch ----
async function fetchTicketmaster(cityName: string, from: Date, to: Date, radiusMiles = 25): Promise<RawEvent[]> {
  const key = process.env.TICKETMASTER_KEY;
  if (!key) return [];
  try {
    const qs = new URLSearchParams({
      apikey: key,
      city: cityName,
      radius: String(radiusMiles),
      unit: "miles",
      sort: "date,asc",
      startDateTime: toISO(from),
      endDateTime: toISO(to),
      size: "100",
    });
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${qs.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const list = data?._embedded?.events || [];
    return list.map((ev: any) => {
      const when = ev.dates?.start?.dateTime || ev.dates?.start?.localDate;
      const venue = ev._embedded?.venues?.[0];
      return {
        id: `tm:${ev.id}`,
        title: ev.name,
        start: when ? new Date(when).toISOString() : undefined,
        venue: venue?.name,
        address: [venue?.address?.line1, venue?.city?.name].filter(Boolean).join(", "),
        source: "Ticketmaster",
        url: ev.url,
        free: false,
      } as RawEvent;
    }).filter((e: RawEvent) => !!e.start);
  } catch (err) {
    console.error("Ticketmaster error", err);
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cityHost = (url.searchParams.get("cityHost") || "").toLowerCase();
    const rawHost = (url.searchParams.get("host") || "").toLowerCase();

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const defaultFrom = now();
    const defaultTo = new Date(Date.now() + 60 * DAY_MS);
    const rangeFrom = fromParam ? new Date(fromParam) : defaultFrom;
    const rangeTo = toParam ? new Date(toParam) : defaultTo;

    const city =
      CITIES.find(c => cityHost && cityHost.includes(c.host)) ||
      CITIES.find(c => rawHost && rawHost.includes(c.host)) ||
      CITIES[0];

    const [icsArrays, tm] = await Promise.all([
      Promise.all((city.icsFeeds || []).map(u => fetchICS(u))),
      fetchTicketmaster(city.city, rangeFrom, rangeTo, city.eventRadiusMiles ?? 25),
    ]);

    const ics = icsArrays.flat();

    const merged = [...ics, ...tm]
      .filter(e => !!e.start)
      .filter(e => {
        const t = new Date(e.start).getTime();
        return t >= rangeFrom.getTime() && t <= rangeTo.getTime();
      })
      .filter(e => !isRetailish(e.title || ""));

    const clean = dedupe(merged)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 200);

    return NextResponse.json({
      city: { host: city.host, name: `${city.city}, ${city.state}` },
      count: clean.length,
      from: rangeFrom.toISOString(),
      to: rangeTo.toISOString(),
      events: clean
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
