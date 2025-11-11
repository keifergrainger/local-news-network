export type CityConfig = {
  host: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  heroImage: string;
  tagline: string;
  breaking?: string[]; // add breaking news
};

export const CITIES: CityConfig[] = [
  {
    host: "saltlakeut.com",
    city: "Salt Lake City",
    state: "UT",
    lat: 40.7608,
    lon: -111.8910,
    heroImage:
      "https://images.unsplash.com/photo-1466285746891-30d1cd3a5400?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Salt Lake City",
    breaking: [
      "⚠️ Road Alert: I-15 overnight lane closures near 600 S",
      "🏀 Jazz home game tonight — TRAX running late service",
      "🏛️ City Council meets Tue 6:00 PM — public comment open",
      "❄️ Winter parking rules start Dec 1 — no street parking 1–6 AM",
    ],
  },
  {
    host: "irmosc.com",
    city: "Irmo",
    state: "SC",
    lat: 34.085,
    lon: -81.183,
    heroImage:
      "https://images.unsplash.com/photo-1587613754436-514c2c0563a1?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Irmo",
  },
  {
    host: "caycesc.com",
    city: "Cayce",
    state: "SC",
    lat: 33.965,
    lon: -81.073,
    heroImage:
      "https://images.unsplash.com/photo-1604014237800-1c37de3f6e4d?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Cayce",
  },
  {
    host: "elizabethnc.com",
    city: "Elizabeth City",
    state: "NC",
    lat: 36.2946,
    lon: -76.2510,
    heroImage:
      "https://images.unsplash.com/photo-1503264116251-35a269479413?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Elizabeth City",
  },
  {
    host: "fresnoca.org",
    city: "Fresno",
    state: "CA",
    lat: 36.7378,
    lon: -119.7871,
    heroImage:
      "https://images.unsplash.com/photo-1566954981041-8e8d8ccaa9b6?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Fresno",
  },
  {
    host: "indioca.com",
    city: "Indio",
    state: "CA",
    lat: 33.7206,
    lon: -116.2156,
    heroImage:
      "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Indio",
  },
  {
    host: "kahuluihi.com",
    city: "Kahului",
    state: "HI",
    lat: 20.8893,
    lon: -156.4729,
    heroImage:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Kahului",
  },
  {
    host: "perrisca.com",
    city: "Perris",
    state: "CA",
    lat: 33.7825,
    lon: -117.2286,
    heroImage:
      "https://images.unsplash.com/photo-1584466977773-2f13eaa1e68e?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Perris",
  },
];

export function getCityFromHost(hostname: string): CityConfig {
  const found =
    CITIES.find((c) => hostname.includes(c.host)) ||
    CITIES.find((c) => hostname.includes("localhost")) ||
    CITIES[0];
  return found;
}
