import { NextResponse } from "next/server";
import { loadFilteredEvents, type NormalizedEvent } from "../helpers";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function localYmd(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function thinEvent(e: NormalizedEvent) {
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end ?? undefined,
    venue: e.venue ?? undefined,
    address: e.address ?? undefined,
    url: e.url ?? undefined,
    source: e.source ?? undefined,
    free: e.free ?? undefined,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    const { city, center, range, events } = await loadFilteredEvents(url);

    const byDay = new Map<string, NormalizedEvent[]>();
    for (const ev of events) {
      const day = localYmd(new Date(ev.start));
      const list = byDay.get(day) ?? [];
      list.push(ev);
      byDay.set(day, list);
    }

    const days = Array.from(byDay.entries())
      .map(([date, list]) => {
        const sorted = list.slice().sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        const tops = sorted.slice(0, 2).map(thinEvent);
        return {
          date,
          tops,
          moreCount: Math.max(0, sorted.length - tops.length),
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return NextResponse.json({
      city: { city: city.city, state: city.state },
      center,
      from: range.from ? range.from.toISOString() : null,
      to: range.to ? range.to.toISOString() : null,
      total: events.length,
      days,
    });
  } catch {
    return NextResponse.json({ city: null, center: null, from: null, to: null, total: 0, days: [] });
  }
}
