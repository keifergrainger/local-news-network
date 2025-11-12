// app/api/events/summary/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string; // ISO
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
  free?: boolean;
};

type DaySummary = {
  date: string; // YYYY-MM-DD
  tops: ApiEvent[]; // up to 2
  moreCount: number;
};

// ES5-safe helpers
function pad2(n: number) {
  return n < 10 ? "0" + n : String(n);
}
function localYmd(d: Date) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function toLocalISODate(d: Date) {
  // normalize to "local midnight" ISO string (no TZ drift when parsed later)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
// No /u or \p{…}
function norm(s?: string) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Parse range (default: current month)
    const now = new Date();
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : startOfMonth(now);
    const to = toParam ? new Date(toParam) : endOfMonth(now);

    // Build an absolute URL to our own /api/events, reuse same origin, forward cookies (if any)
    const eventsUrl = new URL(req.url);
    eventsUrl.pathname = "/api/events";
    eventsUrl.search = `from=${encodeURIComponent(toLocalISODate(from))}&to=${encodeURIComponent(
      toLocalISODate(to),
    )}`;

    const eventsResp = await fetch(eventsUrl.toString(), {
      // forward cookies in case your /api/events uses them for city/tenant
      headers: { cookie: req.headers.get("cookie") || "" },
      cache: "no-store",
    });

    const rawEvents: ApiEvent[] = eventsResp.ok ? (await eventsResp.json()).events || [] : [];

    // ---- De-dupe: title + local day + venue/address
    const seen = new Map<string, ApiEvent>();
    for (let i = 0; i < rawEvents.length; i++) {
      const e = rawEvents[i];
      if (!e || !e.title || !e.start) continue;
      const ymd = localYmd(new Date(e.start));
      const key = norm(e.title) + "|" + ymd + "|" + norm(e.venue || e.address);
      if (!seen.has(key)) seen.set(key, e);
    }
    const deduped = Array.from(seen.values());

    // ---- Group by day
    const byDay = new Map<string, ApiEvent[]>();
    for (let i = 0; i < deduped.length; i++) {
      const e = deduped[i];
      const ymd = localYmd(new Date(e.start));
      const list = byDay.get(ymd) || [];
      list.push(e);
      byDay.set(ymd, list);
    }

    // ---- Summaries for every day in range (inclusive)
    const days: DaySummary[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (cursor <= to) {
      const ymd = localYmd(cursor);
      const list = (byDay.get(ymd) || []).slice().sort(function (a, b) {
        return +new Date(a.start) - +new Date(b.start);
      });
      const tops = list.slice(0, 2);
      const moreCount = Math.max(0, list.length - tops.length);
      days.push({ date: ymd, tops, moreCount });
      cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json(
      {
        from: toLocalISODate(from),
        to: toLocalISODate(to),
        days: days.sort(function (a, b) {
          return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
        }),
      },
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" } },
    );
  } catch {
    // Fail-soft: return empty calendar structure
    return NextResponse.json({ days: [] }, { status: 200 });
  }
}
