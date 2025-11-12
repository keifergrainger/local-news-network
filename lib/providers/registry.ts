import { Provider, ProviderClient } from "./base";
import { GooglePlacesProvider } from "./googlePlaces";
import { YelpProvider } from "./yelp";
import { GeoapifyProvider } from "./geoapify";

type ProviderInfo = {
  name: Provider;
  client: ProviderClient;
  missingKey: boolean;
};

const PROVIDER_ORDER: Provider[] = ["geoapify", "google", "yelp"];

function normalizePreferred(name?: string | null): Provider {
  const slug = (name || "").toLowerCase();
  if (slug === "google" || slug === "yelp" || slug === "geoapify") return slug;
  return "geoapify";
}

function providerKey(name: Provider): string {
  if (name === "google") return process.env.GOOGLE_MAPS_API_KEY || "";
  if (name === "yelp") return process.env.YELP_API_KEY || "";
  return process.env.GEOAPIFY_API_KEY || "";
}

function createClient(name: Provider): ProviderClient {
  if (name === "google") return new GooglePlacesProvider(process.env.GOOGLE_MAPS_API_KEY);
  if (name === "yelp") return new YelpProvider(process.env.YELP_API_KEY);
  return new GeoapifyProvider(process.env.GEOAPIFY_API_KEY);
}

export function resolveProvider(preferred?: Provider): ProviderInfo {
  const normalized = normalizePreferred(preferred || process.env.BUSINESS_PROVIDER);
  const order = [normalized, ...PROVIDER_ORDER.filter((p) => p !== normalized)];

  for (const name of order) {
    if (providerKey(name)) {
      return { name, client: createClient(name), missingKey: false };
    }
  }

  return { name: normalized, client: createClient(normalized), missingKey: true };
}
