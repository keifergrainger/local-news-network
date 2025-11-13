export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { loadEvents, deriveRangeFromQuery, safeDate } from "../_events-util";

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

function dedupeEvents(events: Awaited<ReturnType<typeof loadEvents>>) {
  const seen = new Map<string, typeof events[number]>();
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { start, end } = deriveRangeFromQuery(url);
    const events = dedupeEvents(await loadEvents());
    const filtered = events.filter(e => {
      const d = safeDate(e.start);
      return d && d >= start && d <= end;
    });
    return NextResponse.json({
      events: filtered,
      from: start.toISOString(),
      to: end.toISOString(),
      count: filtered.length
    });
  } catch (err: any) {
    return NextResponse.json({ events: [], error: String(err?.message ?? err) });
  }
}
