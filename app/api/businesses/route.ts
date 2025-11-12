import { NextRequest, NextResponse } from "next/server";
import { getEnvNumber, SearchInput } from "@/lib/providers/base";
import { getCityFromHost } from "@/lib/cities";
import { resolveProvider } from "@/lib/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const { name: provider, client, missingKey } = resolveProvider();

  const host = req.headers.get("host") || "";
  const referer = host ? `https://${host}` : undefined;
  const city = getCityFromHost(host);

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const lat = Number(url.searchParams.get("lat") ?? city.lat);
  const lng = Number(url.searchParams.get("lng") ?? city.lon);
  const radius = Number(url.searchParams.get("radius") ?? getEnvNumber(process.env.CITY_RADIUS_M, 15000));
  const page = url.searchParams.get("page");

  // helps verify city & filters in your terminal
  console.log("[/api/businesses]", { host, city: `${city.city}, ${city.state}`, provider, category, q });

  if (missingKey) {
    const tookMs = Date.now() - t0;
    return NextResponse.json({ items: [], nextCursor: null, provider, tookMs, error: "missing_key" });
  }

  try {
    const input: SearchInput = { q, category, lat, lng, radius, page, referer };
    const res = await client.searchBusinesses(input);
    const tookMs = Date.now() - t0;
    return NextResponse.json({ ...res, tookMs });
  } catch {
    const tookMs = Date.now() - t0;
    return NextResponse.json({ items: [], nextCursor: null, provider, tookMs, error: "upstream_error" }, { status: 200 });
  }
}
