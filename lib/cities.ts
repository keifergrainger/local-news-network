// lib/cities.ts

export type CityConfig = {
  host: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  heroImage: string;
  tagline: string;

  // NEW: headlines + events config
  rssQueries?: string[];        // Google News search queries
  eventRadiusMiles?: number;    // radius for Eventbrite/Ticketmaster
  eventbriteTerms?: string[];   // keywords to bias Eventbrite results
  ticketmasterDMA?: string;     // city/DMA name for Ticketmaster
  icsFeeds?: string[];          // public iCal feeds (no key needed)
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

    // Headlines (tighter, exclude HI overlap)
    rssQueries: [
      `"Salt Lake City" Utah news -Hawaii -HI -Maui -Kahului`,
      `"Salt Lake County" news -Hawaii -HI -Maui -Kahului`,
      `"Salt Lake City" local news -Hawaii -HI -Maui -Kahului`
    ],

    // Events
    eventRadiusMiles: 25,
    eventbriteTerms: ["Salt Lake City", "SLC", "Salt Lake County"],
    ticketmasterDMA: "Salt Lake City",
    icsFeeds: [
      // Your working ICS feed:
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
    rssQueries: [
      `"Irmo" South Carolina news`,
      `"Lexington County" SC news`
    ],
    eventRadiusMiles: 20,
    eventbriteTerms: ["Irmo", "Columbia SC", "Lexington County"],
    ticketmasterDMA: "Columbia",
    icsFeeds: [],
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
    rssQueries: [
      `"Cayce" South Carolina news`,
      `"West Columbia" SC news`
    ],
    eventRadiusMiles: 20,
    eventbriteTerms: ["Cayce", "West Columbia", "Lexington County"],
    ticketmasterDMA: "Columbia",
    icsFeeds: [],
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
    rssQueries: [
      `"Elizabeth City" North Carolina news`,
      `"Pasquotank County" NC news`
    ],
    eventRadiusMiles: 25,
    eventbriteTerms: ["Elizabeth City", "Pasquotank County"],
    ticketmasterDMA: "Norfolk",
    icsFeeds: [],
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
    rssQueries: [
      `"Fresno" California news`,
      `"Fresno County" breaking news`
    ],
    eventRadiusMiles: 30,
    eventbriteTerms: ["Fresno", "Fresno County"],
    ticketmasterDMA: "Fresno/Visalia",
    icsFeeds: [],
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
    rssQueries: [
      `"Indio" California news`,
      `"Coachella Valley" news`
    ],
    eventRadiusMiles: 30,
    eventbriteTerms: ["Indio", "Coachella Valley"],
    ticketmasterDMA: "Palm Springs",
    icsFeeds: [],
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
    rssQueries: [
      `"Kahului" Hawaii news`,
      `"Maui" breaking news`
    ],
    eventRadiusMiles: 30,
    eventbriteTerms: ["Kahului", "Maui"],
    ticketmasterDMA: "Honolulu",
    icsFeeds: [],
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
    rssQueries: [
      `"Perris" California news`,
      `"Riverside County" breaking news`
    ],
    eventRadiusMiles: 25,
    eventbriteTerms: ["Perris", "Riverside County"],
    ticketmasterDMA: "Los Angeles",
    icsFeeds: [],
  },
];

export function getCityFromHost(hostname?: string): CityConfig {
  const host = (hostname || "").toLowerCase();
  return CITIES.find((c) => host.includes(c.host)) || CITIES[0];
}
