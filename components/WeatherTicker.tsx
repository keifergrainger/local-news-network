// components/WeatherTicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCityFromHost } from "@/lib/cities";

/* -------------------- Types -------------------- */
type Article = { title?: string; url?: string; publishedAt?: string; source?: string };
type WeatherNow = {
  temp?: number;           // °F
  feelsLike?: number;      // °F
  wind?: { speed?: number; dir?: number }; // mph + deg
  humidity?: number;       // %
  desc?: string;
  icon?: string;           // optional URL
  unit?: "F" | "C";
};

/* -------------------- Time helpers -------------------- */
function startOfTodayLocal() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function endOfTodayLocal()   { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999); }
function isIso(s?: string) { try { return !!s && !Number.isNaN(Date.parse(s)); } catch { return false; } }
function isTodayLocal(iso?: string) { if (!isIso(iso)) return false; const d = new Date(iso!); return d >= startOfTodayLocal() && d <= endOfTodayLocal(); }

/* -------------------- News helpers -------------------- */
function keyForArticle(a: Article) { return (a.url || a.title || "").trim().toLowerCase(); }
function dedupeKeepNewest(list: Article[]) {
  const map = new Map<string, Article>();
  for (let i = 0; i < list.length; i++) {
    const a = list[i], k = keyForArticle(a); if (!k) continue;
    const prev = map.get(k);
    if (!prev || (+new Date(a.publishedAt || 0) > +new Date(prev.publishedAt || 0))) map.set(k, a);
  }
  return Array.from(map.values());
}

/* -------------------- Weather helpers -------------------- */
function degToDir(d?: number) {
  if (typeof d !== "number" || isNaN(d)) return undefined;
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
  return dirs[Math.round(d/22.5)];
}

async function fetchWeatherLocalFirst(lat: number, lon: number): Promise<WeatherNow | null> {
  // 1) Try your local API shapes
  const tryLocal = async (path: string) => {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      // Normalize several common shapes
      const c = j?.current || j?.now || j;
      if (c?.temp != null || c?.temperature != null || j?.temp != null) {
        return {
          temp: Math.round(c?.temp ?? c?.temperature ?? j?.temp),
          feelsLike: c?.feelsLike ?? c?.apparent ?? j?.feelsLike,
          wind: { speed: c?.wind?.speed ?? c?.windSpeed ?? j?.windSpeed, dir: c?.wind?.dir ?? c?.windDirection ?? j?.windDirection },
          humidity: c?.humidity ?? j?.humidity,
          desc: c?.desc ?? c?.condition ?? j?.desc ?? "Weather",
          icon: c?.icon ?? j?.icon,
          unit: c?.unit ?? j?.unit ?? "F",
        };
      }
      return null;
    } catch { return null; }
  };
  const local =
    (await tryLocal("/api/weather/now")) ||
    (await tryLocal("/api/weather/current")) ||
    (await tryLocal("/api/weather"));

  if (local?.temp != null) return local;

  // 2) Fallback: Open-Meteo (public, CORS ok)
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "auto",
    }).toString();
    const r = await fetch(url.toString(), { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const cur = j?.current || {};
    return {
      temp: Math.round(cur.temperature_2m ?? j?.current_weather?.temperature),
      feelsLike: cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : undefined,
      wind: { speed: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : undefined, dir: cur.wind_direction_10m },
      humidity: cur.relative_humidity_2m,
      desc: codeToDesc(cur.weather_code),
      unit: "F",
    };
  } catch { return null; }
}

function codeToDesc(code?: number) {
  const c = code ?? -1;
  if ([0].includes(c)) return "Clear";
  if ([1, 2].includes(c)) return "Partly Cloudy";
  if ([3].includes(c)) return "Cloudy";
  if ([45, 48].includes(c)) return "Fog";
  if ([51,53,55,61,63,65].includes(c)) return "Rain";
  if ([71,73,75].includes(c)) return "Snow";
  if ([80,81,82].includes(c)) return "Showers";
  if ([95,96,99].includes(c)) return "Storms";
  return "Weather";
}

/* -------------------- Component -------------------- */
export default function WeatherTicker() {
  // City/Host
  const [host, setHost] = useState("");
  useEffect(() => { if (typeof window !== "undefined") setHost(window.location.hostname || ""); }, []);
  const city = getCityFromHost(host);

  // State
  const [articles, setArticles] = useState<Article[]>([]);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [nowText, setNowText] = useState<string>("");

  // Ticker anim vars
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dupRef   = useRef<HTMLDivElement | null>(null);
  const rootRef  = useRef<HTMLDivElement | null>(null);

  // Clock (subtle, TV-like)
  useEffect(() => {
    const fmt = () => setNowText(new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
    fmt();
    const t = window.setInterval(fmt, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // News polling (60s)
  useEffect(() => {
    let t: number | null = null;
    async function refreshNews() {
      try {
        const qs = new URLSearchParams({
          from: startOfTodayLocal().toISOString(),
          to: endOfTodayLocal().toISOString(),
          ...(host ? { host: host.toLowerCase(), cityHost: host.toLowerCase() } : {}),
        });
        const r = await fetch(`/api/news?${qs.toString()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const raw: Article[] =
          Array.isArray(j.articles) ? j.articles :
          Array.isArray(j.news)     ? j.news     :
          Array.isArray((j as any).items) ? (j as any).items : [];
        const todays = raw.filter(a => isTodayLocal(a.publishedAt));
        const merged = dedupeKeepNewest([...articles, ...todays])
          .filter(a => isTodayLocal(a.publishedAt))
          .sort((a,b) => +new Date(b.publishedAt || 0) - +new Date(a.publishedAt || 0));
        setArticles(merged);
      } catch { /* ignore */ }
    }
    refreshNews();
    t = window.setInterval(refreshNews, 60_000);
    return () => { if (t) window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // Weather refresh (10m)
  useEffect(() => {
    let t: number | null = null;
    async function refreshWx() {
      const w = await fetchWeatherLocalFirst(city.lat, city.lon);
      if (w) setWeather(w);
    }
    refreshWx();
    t = window.setInterval(refreshWx, 10 * 60_000);
    return () => { if (t) window.clearInterval(t); };
  }, [city.lat, city.lon]);

  // Build: 2 news → weather → repeat
  const items = useMemo(() => {
    const out: Array<{ kind: "news" | "weather"; data?: Article }> = [];
    let n = 0;
    for (let i = 0; i < articles.length; i++) {
      out.push({ kind: "news", data: articles[i] });
      if (++n % 2 === 0 && weather) out.push({ kind: "weather" });
    }
    if (!articles.length && weather) out.push({ kind: "weather" });
    return out;
  }, [articles, weather]);

  // Measure content → set CSS var for speed (smooth, non-overwhelming)
  useEffect(() => {
    const root = rootRef.current, track = trackRef.current;
    if (!root || !track) return;
    const contentWidth = track.scrollWidth;
    const speedPxPerSec = 60;                // TV-ish pace
    const duration = Math.max(20, Math.round(contentWidth / speedPxPerSec));
    root.style.setProperty("--ticker-duration", `${duration}s`);
  }, [items, weather?.temp, weather?.feelsLike, weather?.wind?.speed]);

  return (
    <div ref={rootRef} className="w-full border-b border-gray-800 bg-[#0a0a0a]/90 backdrop-blur">
      {/* Header strip */}
      <div className="flex items-center gap-3 px-3 py-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-red-600 text-white text-[10px] font-semibold px-2 py-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </span>
        <span className="text-[11px] text-gray-300">{city.city}, {city.state}</span>
        <span className="text-[11px] text-gray-500">•</span>
        <span className="text-[11px] text-gray-300">{nowText}</span>
      </div>

      {/* Ticker line */}
      <div className="relative overflow-hidden">
        <div className="ticker-track will-change-transform">
          {/* pass 1 */}
          <div ref={trackRef} className="flex items-center gap-3 pr-6">
            {items.length === 0 ? (
              <span className="text-xs text-gray-500 px-3 py-2">No fresh news yet today.</span>
            ) : items.map((it, idx) => (
              <TickerItem key={idx} kind={it.kind} data={it.data} weather={weather} />
            ))}
          </div>
          {/* pass 2 (duplicate for seamless loop) */}
          <div ref={dupRef} className="flex items-center gap-3 pr-6" aria-hidden>
            {items.length === 0 ? (
              <span className="text-xs text-gray-500 px-3 py-2">No fresh news yet today.</span>
            ) : items.map((it, idx) => (
              <TickerItem key={`dup-${idx}`} kind={it.kind} data={it.data} weather={weather} />
            ))}
          </div>
        </div>
      </div>

      {/* Scoped CSS for marquee */}
      <style jsx global>{`
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll var(--ticker-duration, 30s) linear infinite;
        }
        .ticker-track > div { display: flex; }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* -------------------- Pieces -------------------- */
function TickerItem(props: { kind: "news" | "weather"; data?: Article; weather: WeatherNow | null }) {
  if (props.kind === "weather") {
    const w = props.weather;
    const dir = degToDir(w?.wind?.dir);
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-gray-800 bg-black/40 px-3 py-1.5">
        <span className="text-base">⛅</span>
        <span className="text-sm text-gray-100 font-semibold">
          {w?.temp != null ? Math.round(w.temp) : "--"}°{w?.unit || "F"}
        </span>
        <span className="text-[11px] text-gray-400">
          {w?.desc || "Weather"}
          {w?.feelsLike != null ? ` • Feels ${Math.round(w.feelsLike)}°` : ""}
          {w?.wind?.speed != null ? ` • ${dir ?? ""}${dir ? " " : ""}${Math.round(w.wind.speed)} mph` : ""}
          {w?.humidity != null ? ` • Hum ${Math.round(w.humidity)}%` : ""}
        </span>
      </div>
    );
  }

  const a = props.data!;
  const time = isIso(a.publishedAt) ? new Date(a.publishedAt!).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <>
      <a
        href={a.url || "#"}
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-center gap-2 rounded-md border border-gray-800 bg-black/30 px-3 py-1.5 hover:border-gray-700"
      >
        <span className="text-[11px] text-gray-400">{time}{a.source ? ` • ${a.source}` : ""}</span>
        <span className="text-sm text-gray-100 max-w-[32rem] truncate group-hover:underline">
          {a.title}
        </span>
      </a>
      <span className="text-gray-700">|</span>
    </>
  );
}
