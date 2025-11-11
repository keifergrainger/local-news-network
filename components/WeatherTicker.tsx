// components/WeatherTicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCityFromHost } from "@/lib/cities";

/* ---------- Config ---------- */
const LABEL_TEXT = "NEWS UPDATE";
const SPEED_PX_PER_SEC = 60;

/* ---------- Types ---------- */
type Article = { title?: string; url?: string; publishedAt?: string; source?: string };
type WeatherNow = {
  temp?: number; feelsLike?: number; wind?: { speed?: number; dir?: number };
  humidity?: number; desc?: string; icon?: string; unit?: "F" | "C";
};

/* ---------- Time helpers ---------- */
function startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0,0,0,0); }
function endOfToday()   { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23,59,59,999); }
function isIso(s?: string) { try { return !!s && !Number.isNaN(Date.parse(s)); } catch { return false; } }
function isTodayLocal(iso?: string) { if (!isIso(iso)) return false; const d = new Date(iso!); return d >= startOfToday() && d <= endOfToday(); }

/* ---------- News helpers ---------- */
function keyForArticle(a: Article) { return (a.url || a.title || "").trim().toLowerCase(); }
function dedupeKeepNewest(list: Article[]) {
  const map = new Map<string, Article>();
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; const k = keyForArticle(a); if (!k) continue;
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
    const published = r.publishedAt || r.pubDate || r.date || r.datetime || r.time || r.timestamp || r.created_at || r.createdAt;
    const publishedAt = isIso(published) ? new Date(published).toISOString() : undefined;
    const title = (r.title || r.headline || r.name || "").toString();
    const source = (r.source || r.site || r.publisher || r.outlet || "").toString();
    out.push({ title, url, publishedAt, source });
  }
  return out;
}

/* ---------- Weather helpers ---------- */
function degToDir(d?: number) {
  if (typeof d !== "number" || isNaN(d)) return undefined;
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
  return dirs[Math.round(d/22.5)];
}
async function fetchWeatherLocalFirst(lat: number, lon: number): Promise<WeatherNow | null> {
  const tryLocal = async (path: string) => {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      const c = j?.current || j?.now || j;
      const temp = c?.temp ?? c?.temperature ?? j?.temp;
      if (temp == null) return null;
      return {
        temp: Math.round(temp),
        feelsLike: c?.feelsLike ?? c?.apparent ?? j?.feelsLike,
        wind: { speed: c?.wind?.speed ?? c?.windSpeed ?? j?.windSpeed, dir: c?.wind?.dir ?? c?.windDirection ?? j?.windDirection },
        humidity: c?.humidity ?? j?.humidity,
        desc: c?.desc ?? c?.condition ?? j?.desc ?? "Weather",
        icon: c?.icon ?? j?.icon,
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
  if ([1,2].includes(c)) return "Partly Cloudy";
  if ([3].includes(c)) return "Cloudy";
  if ([45,48].includes(c)) return "Fog";
  if ([51,53,55,61,63,65].includes(c)) return "Rain";
  if ([71,73,75].includes(c)) return "Snow";
  if ([80,81,82].includes(c)) return "Showers";
  if ([95,96,99].includes(c)) return "Storms";
  return "Weather";
}

/* ---------- Component ---------- */
export default function WeatherTicker() {
  const [host, setHost] = useState("");
  useEffect(() => { if (typeof window !== "undefined") setHost(window.location.hostname || ""); }, []);
  const city = getCityFromHost(host);

  const [articles, setArticles] = useState<Article[]>([]);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [nowText, setNowText] = useState<string>("");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pass1Ref = useRef<HTMLDivElement | null>(null);

  // clock
  useEffect(() => {
    const tick = () => setNowText(new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // news (60s)
  useEffect(() => {
    let t: number | null = null;
    async function refreshNews() {
      try {
        const qs = new URLSearchParams({
          from: startOfToday().toISOString(),
          to: endOfToday().toISOString(),
          ...(host ? { host: host.toLowerCase(), cityHost: host.toLowerCase() } : {}),
        });
        const r = await fetch(`/api/news?${qs.toString()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const raw = coerceArticles(j);
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

  // weather (10m)
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

  // interleave: 2 news → 1 weather
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

  // pace marquee by content width
  useEffect(() => {
    const root = rootRef.current, pass1 = pass1Ref.current;
    if (!root || !pass1) return;
    const w = pass1.scrollWidth || 1;
    const dur = Math.max(20, Math.round(w / SPEED_PX_PER_SEC));
    root.style.setProperty("--ticker-duration", `${dur}s`);
  }, [items, weather?.temp, weather?.feelsLike, weather?.wind?.speed]);

  return (
    <div className="w-full">
      <div ref={rootRef} className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-white/85 to-slate-100/70 dark:from-slate-900/70 dark:to-slate-900/40">
        {/* Left badge */}
        <div className="absolute left-2 top-1.5 z-20 flex h-7 items-stretch select-none">
          <div className="flex items-center rounded-l-md bg-gradient-to-r from-[#1d4ed8] to-[#60a5fa] px-3 shadow-md">
            <span className="text-[11px] font-extrabold tracking-wide text-white">{LABEL_TEXT}</span>
          </div>
          <div className="w-3 skew-x-[-20deg] bg-gradient-to-r from-[#60a5fa] to-white/0 shadow-md rounded-r-sm" />
        </div>

        {/* subtle pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay">
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_10%,#000_1px,transparent_1px)] [background-size:10px_10px]" />
        </div>

        {/* meta row */}
        <div className="relative z-10 flex items-center gap-2 pl-36 pr-3 pt-1 text-[11px] text-slate-700 dark:text-slate-300">
          <span className="font-medium">{getCityFromHost(host).city}, {getCityFromHost(host).state}</span>
          <span className="text-slate-400">•</span>
          <span>{nowText}</span>
        </div>

        {/* ticker */}
        <div className="relative z-10 mt-1 flex items-center">
          <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white/80 to-transparent dark:from-slate-900/70 pointer-events-none" />
          <div className="ticker-lane group ml-36 pr-10 hover:[animation-play-state:paused]">
            {/* pass 1 */}
            <div ref={pass1Ref} className="ticker-pass">
              {items.length === 0 ? (
                <span className="mx-3 rounded-md border border-slate-300/70 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                  No fresh news yet today.
                </span>
              ) : items.map((it, idx) => (
                <TickerItem key={`p1-${idx}`} kind={it.kind} data={it.data} weather={weather} />
              ))}
            </div>
            {/* pass 2 */}
            <div className="ticker-pass" aria-hidden>
              {items.length === 0 ? (
                <span className="mx-3 rounded-md border border-slate-300/70 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                  No fresh news yet today.
                </span>
              ) : items.map((it, idx) => (
                <TickerItem key={`p2-${idx}`} kind={it.kind} data={it.data} weather={weather} />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 h-[3px] bg-gradient-to-r from-slate-300/70 via-white/70 to-slate-300/70 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700" />
      </div>

      <style jsx>{`
        .ticker-lane {
          display: flex;
          width: max-content;
          animation: ticker-scroll var(--ticker-duration, 30s) linear infinite;
        }
        .ticker-pass { display: flex; align-items: center; gap: 12px; padding-right: 24px; }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* ---------- Pieces ---------- */
function TickerItem(props: { kind: "news" | "weather"; data?: Article; weather: WeatherNow | null }) {
  if (props.kind === "weather") {
    const w = props.weather;
    const dir = degToDir(w?.wind?.dir);
    return (
      <div className="mx-1 inline-flex items-center gap-2 rounded-md border border-slate-300/70 bg-white/80 px-3 py-1.5 text-slate-800 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100">
        <span className="text-base">⛅</span>
        <span className="text-sm font-semibold">
          {w?.temp != null ? Math.round(w.temp) : "--"}°{w?.unit || "F"}
        </span>
        <span className="text-[11px] text-slate-600 dark:text-slate-300">
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
        className="group mx-1 inline-flex items-center gap-2 rounded-md border border-slate-300/70 bg-white/70 px-3 py-1.5 text-slate-900 shadow-sm hover:bg-white/90 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:border-slate-600"
      >
        <span className="text-[11px] text-slate-500 dark:text-slate-300">{time}{a.source ? ` • ${a.source}` : ""}</span>
        <span className="text-sm max-w-[32rem] truncate group-hover:underline">{a.title}</span>
      </a>
      <span className="mx-1 text-slate-400 dark:text-slate-600" aria-hidden>|</span>
    </>
  );
}

