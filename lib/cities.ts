export type CityConfig = {
  host: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  heroImage: string;
  tagline: string;
  rssQueries?: string[];
  eventRadiusMiles?: number;
  eventbriteTerms?: string[];
  ticketmasterDMA?: string;
  icsFeeds?: string[];
};

export const CITIES: CityConfig[] = [
  // ---- Utah (working ICS included)
  {
    host: "saltlakeut.com",
    city: "Salt Lake City",
    state: "UT",
    lat: 40.7608,
    lon: -111.8910,
    heroImage:
      "https://images.unsplash.com/photo-1466285746891-30d1cd3a5400?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Salt Lake City",
    rssQueries: [
      `"Salt Lake City" Utah news -Hawaii -HI -Maui -Kahului`,
      `"Salt Lake County" news -Hawaii -HI -Maui -Kahului`,
      `"Salt Lake City" local news -Hawaii -HI -Maui -Kahului`
    ],
    eventRadiusMiles: 25,
    eventbriteTerms: ["Salt Lake City", "SLC", "Salt Lake County"],
    ticketmasterDMA: "Salt Lake City",
    icsFeeds: [
      // ✅ Working ICS feed (keeps events showing without any keys)
      "https://msd.utah.gov/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar"
    ],
  },

  // ---- California
  {
    host: "fresnoca.org",
    city: "Fresno",
    state: "CA",
    lat: 36.7378,
    lon: -119.7871,
    heroImage:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb2?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Fresno",
    rssQueries: [`"Fresno" California news`, `"Fresno County" news`],
    eventRadiusMiles: 25,
    eventbriteTerms: ["Fresno", "Fresno County"],
    ticketmasterDMA: "Fresno",
    icsFeeds: [], // ← add local ICS feeds to get events without keys
  },
  {
    host: "indioca.com",
    city: "Indio",
    state: "CA",
    lat: 33.7206,
    lon: -116.2156,
    heroImage:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Indio",
    rssQueries: [`"Indio" California news`, `"Coachella Valley" news`],
    eventRadiusMiles: 25,
    eventbriteTerms: ["Indio", "Coachella Valley"],
    ticketmasterDMA: "Palm Springs",
    icsFeeds: [],
  },
  {
    host: "perrisca.com",
    city: "Perris",
    state: "CA",
    lat: 33.7825,
    lon: -117.2286,
    heroImage:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Perris",
    rssQueries: [`"Perris" California news`, `"Riverside County" breaking news`],
    eventRadiusMiles: 25,
    eventbriteTerms: ["Perris", "Riverside County"],
    ticketmasterDMA: "Los Angeles",
    icsFeeds: [],
  },

  // ---- South Carolina
  {
    host: "caycesc.com",
    city: "Cayce",
    state: "SC",
    lat: 33.9654,
    lon: -81.0734,
    heroImage:
      "https://images.unsplash.com/photo-1520975922299-84c42f4e1f8a?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Cayce",
    rssQueries: [`"Cayce" South Carolina news`, `"Lexington County" SC news`],
    eventRadiusMiles: 20,
    eventbriteTerms: ["Cayce", "Columbia SC", "Lexington County"],
    ticketmasterDMA: "Columbia",
    icsFeeds: [],
  },
  {
    host: "irmosc.com",
    city: "Irmo",
    state: "SC",
    lat: 34.0854,
    lon: -81.1832,
    heroImage:
      "https://images.unsplash.com/photo-1587613754436-514c2c0563a1?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Irmo",
    rssQueries: [`"Irmo" South Carolina news`, `"Lexington County" SC news`],
    eventRadiusMiles: 20,
    eventbriteTerms: ["Irmo", "Columbia SC", "Lexington County"],
    ticketmasterDMA: "Columbia",
    icsFeeds: [], // ← add local ICS feeds for free events without keys
  },

  // ---- North Carolina
  {
    host: "elizabethnc.com",
    city: "Elizabeth City",
    state: "NC",
    lat: 36.2946,
    lon: -76.2510,
    heroImage:
      "https://images.unsplash.com/photo-1520975922299-84c42f4e1f8a?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Elizabeth City",
    rssQueries: [`"Elizabeth City" North Carolina news`, `"Pasquotank County" news`],
    eventRadiusMiles: 20,
    eventbriteTerms: ["Elizabeth City", "Pasquotank County"],
    ticketmasterDMA: "Norfolk",
    icsFeeds: [],
  },

  // ---- Hawaii
  {
    host: "kahuluihi.com",
    city: "Kahului",
    state: "HI",
    lat: 20.8890,
    lon: -156.4729,
    heroImage:
      "https://images.unsplash.com/photo-1535321834298-0c6df5874656?q=80&w=1600&auto=format&fit=crop",
    tagline: "Your Local Hub — News & Events in Kahului",
    rssQueries: [`"Kahului" Maui news`, `"Maui County" news`],
    eventRadiusMiles: 25,
    eventbriteTerms: ["Kahului", "Maui"],
    ticketmasterDMA: "Honolulu",
    icsFeeds: [],
  },
];

export function getCityFromHost(hostname?: string): CityConfig {
  const host = (hostname || "").toLowerCase().split(":")[0];
  return CITIES.find((c) => host.includes(c.host)) || CITIES[0];
}

/** Back-compat helper used by the nav and pages */
export function cityLabel(c: { city: string; state: string }) {
  return `${c.city}, ${c.state}`;
}
