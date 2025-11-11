export type CityConfig = {
  host: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  heroImage: string;
  tagline: string;
  breaking?: string[];      // optional manual items (still supported)
  rssQueries?: string[];    // ← add: queries for automatic headlines
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

  // News RSS (leave as-is if you already have this)
  rssQueries: [
    `"Salt Lake City" Utah news -Hawaii -HI -Maui -Kahului`,
    `"Salt Lake County" news -Hawaii -HI -Maui -Kahului`,
    `"Salt Lake City" local news -Hawaii -HI -Maui -Kahului`
  ],

  // 👇 NEW: events sources (no API keys required for ICS)
  eventRadiusMiles: 25,
  eventbriteTerms: ["Salt Lake City", "SLC", "Salt Lake County"],
  ticketmasterDMA: "Salt Lake City",
  icsFeeds: [
    "https://msd.utah.gov/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar"
  ],
},
  {
    host: "irmosc.com",
    city: "Irmo",
    state: "SC",
    lat: 34.0857,
    lon: -81.1832,
    heroImage:
      "https://images.unsplash.com/photo-1587613754436-514c2c0563a1?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Irmo",
    rssQueries: ["Irmo SC news", "Lexington County news"],
  },
  {
    host: "caycesc.com",
    city: "Cayce",
    state: "SC",
    lat: 33.9657,
    lon: -81.0734,
    heroImage:
      "https://images.unsplash.com/photo-1604014237800-1c37de3f6e4d?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Cayce",
    rssQueries: ["Cayce SC news", "West Columbia news"],
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
    rssQueries: ["Elizabeth City NC news", "Pasquotank County news"],
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
    rssQueries: ["Fresno CA news", "Fresno County breaking"],
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
    rssQueries: ["Indio CA news", "Coachella Valley news"],
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
    rssQueries: ["Kahului news", "Maui breaking news"],
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
    rssQueries: ["Perris CA news", "Riverside County breaking"],
  },
];

export function getCityFromHost(hostname?: string): CityConfig {
  const host = (hostname || "").toLowerCase();
  return (
    CITIES.find((c) => host.includes(c.host)) ||
    CITIES[0]
  );
}
