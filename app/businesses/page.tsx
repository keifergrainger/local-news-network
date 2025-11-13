import { Metadata } from "next";
import CategoryChips from "./_components/CategoryChips";
import SearchBar from "./_components/SearchBar";
import DirectoryGrid from "./_components/DirectoryGrid";
import { getEnvNumber } from "@/lib/providers/base";
import { headers } from "next/headers";
import { getCityFromHost, cityLabel } from "@/lib/cities";

export const metadata: Metadata = {
  title: "Best Local Businesses &mdash; Directory",
  description: "Find top-rated coffee, plumbers, HVAC, restaurants, and more near you.",
};

const DEFAULT_CATEGORY = "Coffee";

export default async function Page() {
  const hostHeader = headers().get("host") || "";
  const city = getCityFromHost(hostHeader);
  const radius = getEnvNumber(process.env.CITY_RADIUS_M, 15000);

  const providerLabel = "geoapify";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: [] as any[],
  };

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

      <DirectoryGrid
        defaultCategory={DEFAULT_CATEGORY}
        defaultLat={city.lat}
        defaultLng={city.lon}
        defaultRadius={radius}
        provider={providerLabel}
      />
    </div>
  );
}



