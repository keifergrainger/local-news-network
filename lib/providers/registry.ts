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

function envKey(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

function normalizePreferred(name?: string | null): Provider {
  const slug = (name || "").toLowerCase();
  if (slug === "google" || slug === "yelp" || slug === "geoapify") return slug;
  return "geoapify";
}

function providerKey(name: Provider): string {
  if (name === "google") return envKey("GOOGLE_MAPS_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  if (name === "yelp") return envKey("YELP_API_KEY", "NEXT_PUBLIC_YELP_API_KEY");
  return envKey("GEOAPIFY_API_KEY", "NEXT_PUBLIC_GEOAPIFY_API_KEY");
}

function createClient(name: Provider): ProviderClient {
  if (name === "google") return new GooglePlacesProvider(providerKey("google"));
  if (name === "yelp") return new YelpProvider(providerKey("yelp"));
  return new GeoapifyProvider(providerKey("geoapify"));
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
