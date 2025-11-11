import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

type RawEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchICS(url: string): Promise<RawEvent[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const out: RawEvent[] = [];
    const blocks = text.split("BEGIN:VEVENT").slice(1);
    for (const b of blocks) {
      const title = /SUMMARY:(.+)/.exec(b)?.[1]?.trim();
      const start = /DTSTART(?:;[^:]+)?:([^\n\r]+)/.exec(b)?.[1]?.trim();
      const loc = /LOCATION:(.+)/.exec(b)?.[1]?.trim();
      if (!title || !start) continue;
      out.push({
        id: `ics:${start}:${title}`,
        title,
        start: start,
        venue: loc,
        address: loc,
        source: "ICS"
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cityHost = (url.searchParams.get("cityHost") || "").toLowerCase();
    const city =
      CITIES.find(c => cityHost && cityHost.includes(c.host)) || CITIES[0];

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : new Date();
    const to = toParam ? new Date(toParam) : new Date(Date.now() + 30 * DAY_MS);

    const icsResults = await Promise.all(
      (city.icsFeeds || []).map(url => fetchICS(url))
    );

    const merged = icsResults.flat().filter(e => {
      const t = new Date(e.start).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });

    return NextResponse.json({
      city: { host: city.host, name: `${city.city}, ${city.state}` },
      count: merged.length,
      from: from.toISOString(),
      to: to.toISOString(),
      events: merged
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
