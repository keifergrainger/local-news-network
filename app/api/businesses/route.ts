import { NextRequest, NextResponse } from "next/server";
import { getEnvNumber, Provider, ProviderClient, SearchInput } from "@/lib/providers/base";
import { GooglePlacesProvider } from "@/lib/providers/googlePlaces";
import { YelpProvider } from "@/lib/providers/yelp";
import { GeoapifyProvider } from "@/lib/providers/geoapify";
import { getCityFromHost } from "@/lib/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getProvider(): { name: Provider; client: ProviderClient; missingKey: boolean } {
  const p = (process.env.BUSINESS_PROVIDER || "google").toLowerCase() as Provider;
  if (p === "geoapify") {
    const key = process.env.GEOAPIFY_API_KEY || "";
    return { name: "geoapify", client: new GeoapifyProvider(key), missingKey: !key };
  }
  if (p === "yelp") {
    const key = process.env.YELP_API_KEY || "";
    return { name: "yelp", client: new YelpProvider(key), missingKey: !key };
  }
  const key = process.env.GOOGLE_MAPS_API_KEY || "";
  return { name: "google", client: new GooglePlacesProvider(key), missingKey: !key };
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const { name: provider, client, missingKey } = getProvider();

  const host = req.headers.get("host") || "";
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
    const input: SearchInput = { q, category, lat, lng, radius, page };
    const res = await client.searchBusinesses(input);
    const tookMs = Date.now() - t0;
    return NextResponse.json({ ...res, tookMs });
  } catch {
    const tookMs = Date.now() - t0;
    return NextResponse.json({ items: [], nextCursor: null, provider, tookMs, error: "upstream_error" }, { status: 200 });
  }
}
