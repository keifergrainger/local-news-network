import { NextResponse } from "next/server";
import { loadFilteredEvents, type NormalizedEvent } from "../helpers";

const dayFormatterCache = new Map<string, Intl.DateTimeFormat>();

function ensureDayFormatter(timeZone: string) {
  let fmt = dayFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatterCache.set(timeZone, fmt);
  }
  return fmt;
}

function ymdInTimeZone(date: Date, timeZone: string) {
  const fmt = ensureDayFormatter(timeZone);
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    map[part.type] = part.value;
  }
  const year = map.year ?? String(date.getUTCFullYear());
  const month = map.month ?? String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = map.day ?? String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractYearMonth(date: Date | null, timeZone: string) {
  if (!date) return null;
  const fmt = ensureDayFormatter(timeZone);
  const parts = fmt.formatToParts(date);
  let year: number | null = null;
  let month: number | null = null;
  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    if (part.type === "month") month = Number(part.value);
  }
  if (Number.isFinite(year) && Number.isFinite(month)) {
    return { year: year!, month: month! };
  }
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
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

    const timeZone = city.timeZone || "UTC";
    const anchor = range.from ?? range.to ?? null;
    const anchorMonth = extractYearMonth(anchor, timeZone);

    const byDay = new Map<string, NormalizedEvent[]>();
    for (const ev of events) {
      const day = ymdInTimeZone(new Date(ev.start), timeZone);
      const list = byDay.get(day) ?? [];
      list.push(ev);
      byDay.set(day, list);
    }

    const days = Array.from(byDay.entries())
      .filter(([date]) => {
        if (!anchorMonth) return true;
        const [y, m] = date.split("-").map((part) => Number(part));
        if (!Number.isFinite(y) || !Number.isFinite(m)) return false;
        return y === anchorMonth.year && m === anchorMonth.month;
      })
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
