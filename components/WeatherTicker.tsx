// components/WeatherTicker.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';

type Headline = { title: string; link: string; pubDate?: string };
type WeatherNow = { temp?: number; unit?: 'F' | 'C'; desc?: string; icon?: string };

const PIXELS_PER_SECOND = 50; // why: smooth marquee speed across screen sizes

/* ---------- time helpers ---------- */
function startOfTodayLocal() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0); }
function endOfTodayLocal()   { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999); }
function isIso(s?: string) { try { return !!s && !Number.isNaN(Date.parse(s!)); } catch { return false; } }
function isTodayLocal(iso?: string) {
  if (!isIso(iso)) return false;
  const t = new Date(iso!);
  return t >= startOfTodayLocal() && t <= endOfTodayLocal();
}

/* ---------- news helpers ---------- */
function articleKey(h: Headline) {
  const u = (h.link || '').trim().toLowerCase();
  const t = (h.title || '').trim().toLowerCase();
  return u || t;
}
function dedupeKeepNewest(arr: Headline[]) {
  const map = new Map<string, Headline>();
  for (let i = 0; i < arr.length; i++) {
    const h = arr[i]; const k = articleKey(h); if (!k) continue;
    const prev = map.get(k);
    if (!prev || (+new Date(h.pubDate || 0) > +new Date(prev.pubDate || 0))) map.set(k, h);
  }
  return Array.from(map.values());
}

/* ---------- weather fetch (Open-Meteo) ---------- */
async function fetchWeather(lat: number, lon: number): Promise<WeatherNow | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,apparent_temperature,weather_code',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      timezone: 'auto',
    }).toString();

    const r = await fetch(url.toString(), { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    const code = j?.current?.weather_code as number | undefined;
    const desc = code != null ? codeToDesc(code) : undefined;
    const icon = code != null ? codeToEmojiUrl(code) : undefined;

    return {
      temp: Math.round(j?.current?.temperature_2m ?? j?.current_weather?.temperature ?? NaN),
      unit: 'F',
      desc: desc || 'Weather',
      icon,
    };
  } catch {
    return null;
  }
}

// extremely small mapping; expand as needed
function codeToDesc(code: number) {
  if ([0].includes(code)) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly Cloudy';
  if ([3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
  if ([71, 73, 75].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Showers';
  if ([95, 96, 99].includes(code)) return 'Storms';
  return 'Weather';
}
function codeToEmojiUrl(code: number) {
  // simple emoji as data-url alternative; keep it light
  return ''; // keep empty -> fallback to ⛅ symbol
}

/* ---------- component ---------- */
export default function WeatherTicker() {
  const [host, setHost] = useState('');
  const city = getCityFromHost(host);

  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  const copy1Ref = useRef<HTMLDivElement | null>(null);
  const copy2Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setHost(window.location.hostname || '');
  }, []);

  // fetch today-only headlines & dedupe; poll every 60s
  useEffect(() => {
    let timer: number | null = null;

    async function refreshNews() {
      try {
        const qs = new URLSearchParams({ host: host.toLowerCase() });
        const r = await fetch(`/api/news?${qs.toString()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const raw: Headline[] = Array.isArray(j.headlines) ? j.headlines : Array.isArray(j.articles) ? j.articles : [];
        const todays = raw.filter((h) => isTodayLocal(h.pubDate));
        const merged = dedupeKeepNewest([...headlines, ...todays])
          .filter((h) => isTodayLocal(h.pubDate))
          .sort((a, b) => +new Date(b.pubDate || 0) - +new Date(a.pubDate || 0));
        setHeadlines(merged);
      } catch {
        /* ignore */
      }
    }

    refreshNews();
    timer = window.setInterval(refreshNews, 60_000);
    return () => { if (timer) window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // fetch weather now & every 10 minutes
  useEffect(() => {
    let timer: number | null = null;
    async function refreshWeather() {
      const wx = await fetchWeather(city.lat, city.lon);
      if (wx) setWeather(wx);
    }
    refreshWeather();
    timer = window.setInterval(refreshWeather, 10 * 60_000);
    return () => { if (timer) window.clearInterval(timer); };
  }, [city.lat, city.lon]);

  // interleave: 2 news → 1 weather → repeat
  const items = useMemo(() => {
    const out: Array<{ kind: 'news' | 'weather'; data?: Headline }> = [];
    let n = 0;
    for (let i = 0; i < headlines.length; i++) {
      out.push({ kind: 'news', data: headlines[i] });
      n++;
      if (n % 2 === 0 && weather) out.push({ kind: 'weather' });
    }
    if (!headlines.length && weather) out.push({ kind: 'weather' });
    return out;
  }, [headlines, weather]);

  // render one pass of the line as HTML (keeps your marquee structure)
  const longLine = useMemo(() => {
    if (!items.length) return `<span class="text-gray-500">No fresh news yet today.</span>`;
    const parts: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'news') {
        const h = it.data!;
        const t = (h.title || '').replace(/"/g, '&quot;');
        const link = h.link || '#';
        const time = isIso(h.pubDate)
          ? new Date(h.pubDate!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          : '';
        parts.push(
          `<a class="inline-block rounded-lg border border-gray-800 px-3 py-2 hover:border-gray-700 transition-colors mr-3" href="${link}" target="_blank" rel="noreferrer">
            <span class="text-[11px] text-gray-400">${time}</span>
            <span class="ml-2 text-sm text-gray-100">${t}</span>
          </a>`
        );
      } else {
        const temp = weather?.temp != null ? Math.round(weather.temp) + '°' + (weather?.unit || 'F') : '--';
        const desc = weather?.desc || 'Weather';
        parts.push(
          `<span class="inline-flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 mr-3 min-w-[10rem]">
            <span class="text-lg">⛅</span>
            <span class="text-sm text-gray-100">${temp}</span>
            <span class="text-[11px] text-gray-400">${desc}</span>
          </span>`
        );
      }
    }
    return parts.join('');
  }, [items, weather?.temp, weather?.unit, weather?.desc]);

  // set animation duration proportional to content width
  useEffect(() => {
    const el1 = copy1Ref.current;
    const el2 = copy2Ref.current;
    if (!el1 || !el2) return;
    const width = el1.scrollWidth || 1;
    const seconds = Math.max(10, Math.round(width / PIXELS_PER_SECOND)); // min duration
    el1.style.animationDuration = `${seconds}s`;
    el2.style.animationDuration = `${seconds}s`;
  }, [longLine]);

  return (
    <div className="w-full bg-gradient-to-r from-black/70 via-black/60 to-black/70 border-b border-gray-800">
      <div className="py-2 text-[11px] sm:text-sm text-gray-100">
        <div className="ticker">
          <div ref={copy1Ref} className="px-3" dangerouslySetInnerHTML={{ __html: longLine }} />
          <div ref={copy2Ref} className="px-3" aria-hidden dangerouslySetInnerHTML={{ __html: longLine }} />
        </div>
      </div>
    </div>
  );
}

