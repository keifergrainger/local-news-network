'use client';
// components/WeatherTicker.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { getCityFromHost } from "@/lib/cities";

/* ===== Config ===== */
const SPEED_PX_PER_SEC = 70; // tweak: lower = slower, higher = faster

/* ===== Types ===== */
type Article = { title?: string; url?: string; publishedAt?: string; source?: string };
type WeatherNow = {
  temp?: number; feelsLike?: number; wind?: { speed?: number; dir?: number };
  humidity?: number; desc?: string; unit?: "F" | "C";
};

/* ===== Time ===== */
function todayStart() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0,0,0,0); }
function todayEnd()   { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23,59,59,999); }
function isIso(s?: string) { try { return !!s && !Number.isNaN(Date.parse(s)); } catch { return false; } }
function isToday(iso?: string) { if (!isIso(iso)) return false; const d = new Date(iso!); return d >= todayStart() && d <= todayEnd(); }

/* ===== News helpers ===== */
function keyFor(a: Article) { return (a.url || a.title || "").trim().toLowerCase(); }
function dedupeNewest(list: Article[]) {
  const map = new Map<string, Article>();
  for (let i = 0; i < list.length; i++) {
    const a = list[i], k = keyFor(a); if (!k) continue;
    const prev = map.get(k);
    if (!prev || (+new Date(a.publishedAt || 0) > +new Date(prev.publishedAt || 0))) map.set(k, a);
  }
  return Array.from(map.values());
}
function coerceArticles(j: any): Article[] {
  const pools: any[] = [];
  if (Array.isArray(j?.headlines)) pools.push(j.headlines);
  if (Array.isArray(j?.articles)) pools.push(j.articles);
  if (Array.isArray(j?.news)) pools.push(j.news);
  if (Array.isArray(j?.items)) pools.push(j.items);
  if (Array.isArray(j?.data?.headlines)) pools.push(j.data.headlines);
  if (Array.isArray(j?.data?.articles)) pools.push(j.data.articles);
  if (Array.isArray(j?.data?.items)) pools.push(j.data.items);
  const merged: any[] = pools.flat();

  const out: Article[] = [];
  for (let i = 0; i < merged.length; i++) {
    const r = merged[i] || {};
    const url = (r.url || r.link || r.href || "").toString();
    const pub = r.publishedAt || r.pubDate || r.date || r.datetime || r.time || r.timestamp || r.created_at || r.createdAt;
    const publishedAt = isIso(pub) ? new Date(pub).toISOString() : undefined;
    const title = (r.title || r.headline || r.name || "").toString();
    const source = (r.source || r.site || r.publisher || r.outlet || "").toString();
    out.push({ title, url, publishedAt, source });
  }
  return out;
}

/* ===== Weather helpers ===== */
function degToDir(d?: number) {
  if (typeof d !== "number" || isNaN(d)) return undefined;
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
  return dirs[Math.round(d/22.5)];
}
async function fetchWeather(lat: number, lon: number): Promise<WeatherNow | null> {
  const tryLocal = async (path: string) => {
    try {
      const r = await fetch(path, { cache: "no-store" }); if (!r.ok) return null;
      const j = await r.json(); const c = j?.current || j?.now || j;
      const temp = c?.temp ?? c?.temperature ?? j?.temp; if (temp == null) return null;
      return {
        temp: Math.round(temp),
        feelsLike: c?.feelsLike ?? c?.apparent ?? j?.feelsLike,
        wind: { speed: c?.wind?.speed ?? c?.windSpeed ?? j?.windSpeed, dir: c?.wind?.dir ?? c?.windDirection ?? j?.windDirection },
        humidity: c?.humidity ?? j?.humidity,
        desc: c?.desc ?? c?.condition ?? j?.desc ?? "Weather",
        unit: c?.unit ?? j?.unit ?? "F",
      };
    } catch { return null; }
  };
  const local =
    (await tryLocal("/api/weather/now")) ||
    (await tryLocal("/api/weather/current")) ||
    (await tryLocal("/api/weather"));
  if (local?.temp != null) return local;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(lat), longitude: String(lon),
      current: "temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,relative_humidity_2m,weather_code",
      temperature_unit: "fahrenheit", wind_speed_unit: "mph", timezone: "auto",
    }).toString();
    const r = await fetch(url.toString(), { cache: "no-store" }); if (!r.ok) return null;
    const j = await r.json(); const cur = j?.current || {};
    return {
      temp: Math.round(cur.temperature_2m ?? j?.current_weather?.temperature),
      feelsLike: cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : undefined,
      wind: { speed: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : undefined, dir: cur.wind_direction_10m },
      humidity: cur.relative_humidity_2m,
      desc: (() => {
        const c = cur.weather_code; if (c == null) return "Weather";
        if ([0].includes(c)) return "Clear";
        if ([1,2].includes(c)) return "Partly Cloudy";
        if ([3].includes(c)) return "Cloudy";
        if ([45,48].includes(c)) return "Fog";
        if ([51,53,55,61,63,65].includes(c)) return "Rain";
        if ([71,73,75].includes(c)) return "Snow";
        if ([80,81,82].includes(c)) return "Showers";
        if ([95,96,99].includes(c)) return "Storms";
        return "Weather";
      })(),
      unit: "F",
    };
  } catch { return null; }
}

/* ===== Component ===== */
export default function WeatherTicker() {
  // city (for lat/lon if we hit Open-Meteo)
  const [host, setHost] = useState(""); useEffect(() => { if (typeof window !== "undefined") setHost(window.location.hostname || ""); }, []);
  const city = getCityFromHost(host);

  const [articles, setArticles] = useState<Article[]>([]);
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pass1Ref = useRef<HTMLDivElement | null>(null);

  // news (60s)
  useEffect(() => {
    let t: number | null = null;
    async function refreshNews() {
      try {
        const qs = new URLSearchParams({
          from: todayStart().toISOString(), to: todayEnd().toISOString(),
          ...(host ? { host: host.toLowerCase(), cityHost: host.toLowerCase() } : {}),
        });
        const r = await fetch(`/api/news?${qs.toString()}`, { cache: "no-store" }); if (!r.ok) return;
        const raw = coerceArticles(await r.json());
        const todays = raw.filter(a => isToday(a.publishedAt));
        const merged = dedupeNewest([...articles, ...todays])
          .filter(a => isToday(a.publishedAt))
          .sort((a,b) => +new Date(b.publishedAt || 0) - +new Date(a.publishedAt || 0));
        setArticles(merged);
      } catch {}
    }
    refreshNews(); t = window.setInterval(refreshNews, 60_000);
    return () => { if (t) window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // weather (10m)
  useEffect(() => {
    let t: number | null = null;
    async function refreshWx() { const w = await fetchWeather(city.lat, city.lon); if (w) setWeather(w); }
    refreshWx(); t = window.setInterval(refreshWx, 10 * 60_000);
    return () => { if (t) window.clearInterval(t); };
  }, [city.lat, city.lon]);

  // sequence: 2 news → 1 weather
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

  // set scroll speed by width
  useEffect(() => {
    const root = rootRef.current, pass1 = pass1Ref.current; if (!root || !pass1) return;
    const w = pass1.scrollWidth || 1; const dur = Math.max(16, Math.round(w / SPEED_PX_PER_SEC));
    root.style.setProperty("--ticker-duration", `${dur}s`);
  }, [items, weather?.temp, weather?.feelsLike, weather?.wind?.speed]);

  return (
    <div
      ref={rootRef}
      className="relative w-full overflow-hidden border-b border-slate-800 bg-[#0b1220]"
      aria-label="News and weather ticker"
    >
      {/* gradient fade on edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0b1220] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0b1220] to-transparent" />

      {/* marquee track */}
      <div className="ticker-lane whitespace-nowrap">
        {/* pass 1 */}
        <div ref={pass1Ref} className="ticker-pass whitespace-nowrap">
          {items.length === 0 ? (
            <span className="mx-2 rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs text-slate-200">No fresh news yet today.</span>
          ) : items.map((it, idx) => <TickerItem key={`p1-${idx}`} kind={it.kind} data={it.data} weather={weather} />)}
        </div>
        {/* pass 2 (duplicate) */}
        <div className="ticker-pass whitespace-nowrap" aria-hidden>
          {items.length === 0 ? (
            <span className="mx-2 rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs text-slate-200">No fresh news yet today.</span>
          ) : items.map((it, idx) => <TickerItem key={`p2-${idx}`} kind={it.kind} data={it.data} weather={weather} />)}
        </div>
      </div>

      {/* local styles */}
      <style jsx>{`
        .ticker-lane {
          display: flex;
          width: max-content;
          animation: ticker-scroll var(--ticker-duration, 24s) linear infinite;
        }
        .ticker-pass { display: inline-flex; align-items: center; gap: 14px; padding-right: 28px; }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); } /* 2 equal passes => seamless */
        }
      `}</style>
    </div>
  );
}

/* ===== Items ===== */
function TickerItem(props: { kind: "news" | "weather"; data?: Article; weather: WeatherNow | null }) {
  if (props.kind === "weather") {
    const w = props.weather; const dir = degToDir(w?.wind?.dir);
    return (
      <div className="mx-1 inline-flex flex-none items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-blue-100">
        <span className="text-base leading-none">⛅</span>
        <span className="text-sm font-semibold leading-none">
          {w?.temp != null ? Math.round(w.temp) : "--"}°{w?.unit || "F"}
        </span>
        <span className="text-[11px] leading-none opacity-90">
          {w?.desc || "Weather"}
          {w?.feelsLike != null ? ` • Feels ${Math.round(w.feelsLike)}°` : ""}
          {w?.wind?.speed != null ? ` • ${dir ?? ""}${dir ? " " : ""}${Math.round(w.wind?.speed!)} mph` : ""}
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
        className="group mx-1 inline-flex flex-none items-center gap-2 rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-slate-100 hover:bg-slate-800"
      >
        <span className="text-[11px] text-slate-300 leading-none">{time}{a.source ? ` • ${a.source}` : ""}</span>
        <span className="text-sm max-w-[32rem] truncate leading-none">{a.title}</span>
      </a>
      <span className="mx-1 text-slate-600" aria-hidden>•</span>
    </>
  );
}

