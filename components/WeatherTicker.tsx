'use client';
import { useEffect, useMemo, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';

type Wx = {
  temp: number;      // °F
  feels: number;     // °F
  humidity: number;  // %
  wind: number;      // mph
  windDir: number;   // degrees
  code: number;      // weather code
  updatedISO: string;
};

function codeToText(code: number) {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51,53,55,56,57].includes(code)) return 'Drizzle';
  if ([61,63,65].includes(code)) return 'Rain';
  if ([66,67].includes(code)) return 'Freezing Rain';
  if ([71,73,75,77].includes(code)) return 'Snow';
  if ([80,81,82].includes(code)) return 'Showers';
  if ([85,86].includes(code)) return 'Snow Showers';
  if ([95,96,99].includes(code)) return 'Thunderstorms';
  return 'Conditions';
}
function degToCompass(deg: number) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export default function WeatherTicker() {
  const [host, setHost] = useState('');
  const [wx, setWx] = useState<Wx | null>(null);

  useEffect(() => { if (typeof window !== 'undefined') setHost(window.location.hostname); }, []);
  const city = getCityFromHost(host);

  // fetch weather (F + mph + local timezone)
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
      } catch (e) { console.error(e); }
    }
    fetchWx();
    const id = setInterval(fetchWx, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [city.lat, city.lon]);

  // build items: Weather + Breaking headlines from city config
  const items: string[] = useMemo(() => {
    const wxLine = wx
      ? `🌤 ${city.city}, ${city.state} • ${codeToText(wx.code)} • ${Math.round(wx.temp)}°F (feels ${Math.round(wx.feels)}°) • Humidity ${Math.round(wx.humidity)}% • Wind ${Math.round(wx.wind)} mph ${degToCompass(wx.windDir)} • Updated ${new Date(wx.updatedISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : `Loading weather for ${city.city}…`;

    const breaking = (city as any).breaking as string[] | undefined;
    const news = breaking && breaking.length
      ? breaking.map(t => `⚡ ${t}`)
      : [`💡 Got news or an event? Submit it on /submit`];

    return [wxLine, ...news];
  }, [wx, city]);

  // repeat enough to span any screen width for continuous scroll
  const longLine = useMemo(() => {
    const base = items.join('   •   ');
    return Array(8).fill(base).join('     ');
  }, [items]);

  // full-width bar (no container)
  return (
    <div className="w-full bg-gradient-to-r from-black/70 via-black/60 to-black/70 border-b border-gray-800">
      <div className="py-2 text-[11px] sm:text-sm text-gray-100">
        <div className="ticker">
          <div className="px-3">{longLine}</div>
          <div className="px-3" aria-hidden>{longLine}</div>
        </div>
      </div>
    </div>
  );
}
