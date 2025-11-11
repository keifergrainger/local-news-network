// app/api/events/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCityFromHost } from "@/lib/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string;  // ISO
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
  free?: boolean;
};

type DaySummary = {
  date: string;      // YYYY-MM-DD
  tops: ApiEvent[];  // up to 2
  moreCount: number;
};

function pad2(n: number) { return String(n).padStart(2, "0"); }
function localYmd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function toISO(d: Date) {
  // why: stable inclusive ranges regardless of server TZ
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }

// ✔ No /u flag, no \p{…} classes; still normalizes accents and punctuation.
function norm(s?: string) {
  if (!s) return "";
  return s
    .normalize("NFKD")                // why: split accents
    .replace(/[\u0300-\u036f]/g, "")  // why: drop combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")      // collapse non-alnum
    .trim();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const hostHeader = req.headers.get("host") || "";
    const city = getCityFromHost(hostHeader);

    const now = new Date();
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : startOfMonth(now);
    const to = toParam ? new Date(toParam) : endOfMonth(now);

    const origin = req.nextUrl.origin;
    const eventsResp = await fetch(
      `${origin}/api/events?from=${encodeURIComponent(toISO(from))}&to=${encodeURIComponent(toISO(to))}`,
      { headers: { "x-internal": "events-summary" }, cache: "no-store" }
    );

    if (!eventsResp.ok) {
      return NextResponse.json({ city, from: toISO(from), to: toISO(to), days: [] }, { status: 200 });
    }

    const eventsJson: { events?: ApiEvent[] } = await eventsResp.json();
    const raw = Array.isArray(eventsJson.events) ? eventsJson.events : [];

    // De-dupe: title + local day + venue/address
    const seen = new Map<string, ApiEvent>();
    for (const e of raw) {
      if (!e?.title || !e?.start) continue;
      const ymd = localYmd(new Date(e.start));
      const key = `${norm(e.title)}|${ymd}|${norm(e.venue || e.address)}`;
      if (!seen.has(key)) seen.set(key, e);
    }
    const deduped = [...seen.values()];

    // Group by day
    const byDay = new Map<string, ApiEvent[]>();
    for (const e of deduped) {
      const ymd = localYmd(new Date(e.start));
      const arr = byDay.get(ymd) || [];
      arr.push(e);
      byDay.set(ymd, arr);
    }

    // Build summaries (2 tops + +N more)
    const days: DaySummary[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (cursor <= to) {
      const ymd = localYmd(cursor);
      const list = (byDay.get(ymd) || []).slice().sort((a, b) => +new Date(a.start) - +new Date(b.start));
      const tops = list.slice(0, 2);
      const moreCount = Math.max(0, list.length - tops.length);
      days.push({ date: ymd, tops, moreCount });
      cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json(
      {
        city: { host: city.host, name: `${city.city}, ${city.state}` },
        from: toISO(from),
        to: toISO(to),
        days: days.sort((a, b) => a.date.localeCompare(b.date)),
      },
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ days: [] }, { status: 200 });
  }
}
