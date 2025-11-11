'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';

type Wx = {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  windDir: number;
  code: number;
  updatedISO: string;
};

type Headline = { title: string; link: string; pubDate?: string };

function codeToText(code: number) {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65].includes(code)) return 'Rain';
  if ([66, 67].includes(code)) return 'Freezing Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Showers';
  if ([85, 86].includes(code)) return 'Snow Showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Conditions';
}

function degToCompass(deg: number) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export default function WeatherTicker() {
  const [host, setHost] = useState('');
  const [wx, setWx] = useState<Wx | null>(null);
  const [news, setNews] = useState<Headline[]>([]);
  const copy1Ref = useRef<HTMLDivElement>(null);
  const copy2Ref = useRef<HTMLDivElement>(null);

  const PIXELS_PER_SECOND = 60; // adjust for speed

  useEffect(() => {
    if (typeof window !== 'undefined') setHost(window.location.hostname);
  }, []);
  const city = getCityFromHost(host);

  // Fetch Weather
  useEffect(() => {
    async function fetchWx() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        const c = data?.current || {};
        setWx({
          temp: c.temperature_2m,
          feels: c.apparent_temperature,
          humidity: c.relative_humidity_2m,
          wind: c.wind_speed_10m,
          windDir: c.wind_direction_10m,
          code: c.weather_code,
          updatedISO: c.time
        });
      } catch (e) {
        console.error(e);
      }
    }
    fetchWx();
    const id = setInterval(fetchWx, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [city.lat, city.lon]);

  // Fetch Headlines
  useEffect(() => {
    async function fetchNews() {
      try {
        if (!city?.host) return;
        const res = await fetch(`/api/news?cityHost=${encodeURIComponent(city.host)}`, { cache: 'no-store' });
        const data = await res.json();
        setNews(Array.isArray(data.headlines) ? data.headlines : []);
      } catch (e) {
        console.error(e);
      }
    }
    fetchNews();
    const id = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [city.host]);

  const items = useMemo(() => {
    const wxLine = wx
      ? `🌤 ${city.city}, ${city.state} • ${codeToText(wx.code)} • ${Math.round(wx.temp)}°F (feels ${Math.round(wx.feels)}°) • Humidity ${Math.round(wx.humidity)}% • Wind ${Math.round(wx.wind)} mph ${degToCompass(wx.windDir)}`
      : `Loading weather for ${city.city}…`;
    return [wxLine, ...news.map(n => n.title)];
  }, [wx, news, city]);

  // Combine into HTML with clickable links
  const longLine = useMemo(() => {
    const htmlParts = items.map((text, i) => {
      const link = news[i - 1]?.link;
      return link
        ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="hover:text-blue-400 transition">⚡ ${text}</a>`
        : text;
    });
    const base = htmlParts.join(' • ');
    return Array(6).fill(base).join('     ');
  }, [items, news]);

  useEffect(() => {
    function setDuration() {
      const el = copy1Ref.current;
      if (!el) return;
      const width = el.scrollWidth;
      const seconds = Math.max(10, Math.round(width / PIXELS_PER_SECOND));
      const dur = `${seconds}s`;
      el.style.animationDuration = dur;
      if (copy2Ref.current) copy2Ref.current.style.animationDuration = dur;
    }
    setDuration();
    const ro = new ResizeObserver(setDuration);
    if (copy1Ref.current) ro.observe(copy1Ref.current);
    window.addEventListener('resize', setDuration);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setDuration);
    };
  }, [longLine, PIXELS_PER_SECOND]);

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
