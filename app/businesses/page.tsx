import { Metadata } from "next";
import CategoryChips from "./_components/CategoryChips";
import SearchBar from "./_components/SearchBar";
import DirectoryGrid from "./_components/DirectoryGrid";
import { getEnvNumber } from "@/lib/providers/base";
import { Business } from "@/types/business";
import { headers } from "next/headers";
import { getCityFromHost, cityLabel } from "@/lib/cities";
import { resolveProvider } from "@/lib/providers/registry";

export const metadata: Metadata = {
  title: "Best Local Businesses &mdash; Directory",
  description: "Find top-rated coffee, plumbers, HVAC, restaurants, and more near you.",
};

const DEFAULT_CATEGORY = "Coffee";

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const hostHeader = headers().get("host") || "";
  const city = getCityFromHost(hostHeader);
  const normalizedHost = hostHeader.toLowerCase();
  const refererHost = normalizedHost.includes(city.host) ? hostHeader : city.host;

  const category = typeof searchParams.category === "string" ? searchParams.category : DEFAULT_CATEGORY;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const page = typeof searchParams.page === "string" ? searchParams.page : undefined;
  const latParam = typeof searchParams.lat === "string" ? Number(searchParams.lat) : undefined;
  const lngParam = typeof searchParams.lng === "string" ? Number(searchParams.lng) : undefined;
  const radiusParam = typeof searchParams.radius === "string" ? Number(searchParams.radius) : undefined;

  const lat = Number.isFinite(latParam) ? (latParam as number) : city.lat;
  const lng = Number.isFinite(lngParam) ? (lngParam as number) : city.lon;
  const radius = Number.isFinite(radiusParam)
    ? (radiusParam as number)
    : getEnvNumber(process.env.CITY_RADIUS_M, 15000);

  const { client, name: providerName, missingKey } = resolveProvider();
  const referer = refererHost ? `https://${refererHost.replace(/\/$/, "")}/` : undefined;

  let items: Business[] = [];
  let nextCursor: string | null = null;
  let provider: "google" | "yelp" | "geoapify" = providerName;

  if (!missingKey) {
    try {
      const res = await client.searchBusinesses({
        q: q || null,
        category: category || DEFAULT_CATEGORY,
        lat,
        lng,
        radius,
        page: page || null,
        referer,
      });
      items = res.items;
      nextCursor = res.nextCursor;
      provider = res.provider;
    } catch {
      // swallow to render fallback UI + provider warning
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.slice(0, 10).map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "LocalBusiness", name: b.name, url: b.website || undefined, address: b.address || undefined },
    })),
  };

  const missingProviderKey = missingKey;
  const providerLabel = providerName;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-2xl font-bold text-gray-100">Top Local Businesses in {cityLabel(city)}</h1>
      <p className="mt-1 text-sm text-gray-400">
        Discover the best coffee shops, restaurants, plumbers, HVAC services and more&mdash;rated by locals.
      </p>

      <div className="mt-4">
        <CategoryChips />
      </div>

      <div className="mt-3">
        <SearchBar />
      </div>

      {missingProviderKey ? (
        <div className="mt-6 rounded-2xl border border-yellow-700 bg-yellow-900/20 p-4 text-yellow-200">
          <p className="text-sm">
            API key missing for provider <code className="rounded bg-black/40 px-1">{providerLabel}</code>.
          </p>
        </div>
      ) : null}

      <DirectoryGrid initialItems={items} initialNextCursor={nextCursor} provider={provider} />
    </div>
  );
}



