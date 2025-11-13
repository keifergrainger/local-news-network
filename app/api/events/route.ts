export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { loadEvents, deriveRangeFromQuery, safeDate } from "../_events-util";
import { resolveCity } from "./sources";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { start, end } = deriveRangeFromQuery(url);
    const cityHost = url.searchParams.get("cityHost") || url.searchParams.get("host") || url.hostname || "";
    const city = resolveCity(cityHost || undefined);
    const radiusMiles = city.eventRadiusMiles ?? 25;
    const events = await loadEvents({ city, from: start, to: end, radiusMiles });
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
