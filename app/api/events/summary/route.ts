import { NextRequest, NextResponse } from "next/server";
import { getCityFromHost } from "@/lib/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function monthRange(isoMonth?: string) {
  const base = isoMonth ? new Date(isoMonth + "-01T00:00:00Z") : new Date();
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const city = getCityFromHost(host);

  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? undefined;
  const { start, end } = monthRange(month);

  const lat = url.searchParams.get("lat") ?? String(city.lat);
  const lng = url.searchParams.get("lng") ?? String((city as any).lng ?? (city as any).lon ?? city.lon);
  const radius = url.searchParams.get("radius") ?? String(process.env.EVENTS_DEFAULT_RADIUS_M ?? 40000);
  const debug = url.searchParams.get("debug") || "";
  const sample = url.searchParams.get("sample") || "";

  const base = `http://${host.split(",")[0]}`;
  const rawUrl = new URL("/api/events-local", base);
  rawUrl.searchParams.set("cityHost", city.host);
  rawUrl.searchParams.set("lat", lat);
  rawUrl.searchParams.set("lng", lng);
  rawUrl.searchParams.set("radius", radius);
  rawUrl.searchParams.set("start", start);
  rawUrl.searchParams.set("end", end);
  if (debug) rawUrl.searchParams.set("debug", debug);
  if (sample) rawUrl.searchParams.set("sample", sample);

  try {
    const r = await fetch(rawUrl.toString(), { cache: "no-store" });
    const payload = await r.json();
    const events: Array<{ start?: string }> = Array.isArray(payload?.events)
      ? payload.events
      : [];

    const byDay = new Map<string, number>();
    for (const e of events) {
      const d = e.start ? new Date(e.start) : null;
      if (!d || Number.isNaN(+d)) continue;
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return NextResponse.json({
      city: { city: city.city, state: city.state, lat: Number(lat), lng: Number(lng) },
      month: month ?? new Date().toISOString().slice(0, 7),
      radius: Number(radius),
      total: events.length,
      summary: Array.from(byDay.entries()).map(([day, count]) => ({ day, count })),
      debug: payload?.debug,
    });
  } catch (e: any) {
    return NextResponse.json(
      { city: { city: city.city, state: city.state }, total: 0, summary: [], error: String(e?.message || e) },
      { status: 200 }
    );
  }
}
