'use client';
import { useEffect, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';

type Wx = {
  temp: number;          // °F
  feels: number;         // °F
  humidity: number;      // %
  wind: number;          // mph
  windDir: number;       // degrees
  code: number;          // weather code
  updatedISO: string;    // ISO string
};

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
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export default function WeatherTicker() {
  const [host, setHost] = useState('');
  const [wx, setWx] = useState<Wx | null>(null);

  useEffect(() => { if (typeof window !== 'undefined') setHost(window.location.hostname); }, []);
  const city = getCityFromHost(host);

  useEffect(() => {
    async function fetchWx() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        const cur = data?.current || {};
        setWx({
          temp: cur.temperature_2m,
          feels: cur.apparent_temperature,
          humidity: cur.relative_humidity_2m,
          wind: cur.wind_speed_10m,
          windDir: cur.wind_direction_10m,
          code: cur.weather_code,
          updatedISO: cur.time,
        });
      } catch (e) {
        console.error(e);
      }
    }
    fetchWx();
    const id = setInterval(fetchWx, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [city.lat, city.lon]);

  // Build a single long line that repeats for smooth marquee on phones
  const line = wx
    ? `🌤 ${city.city}, ${city.state} • ${codeToText(wx.code)} • ${Math.round(wx.temp)}°F (feels ${Math.round(wx.feels)}°) • Humidity ${Math.round(wx.humidity)}% • Wind ${Math.round(wx.wind)} mph ${degToCompass(wx.windDir)} • Updated ${new Date(wx.updatedISO).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}`
    : `Loading weather for ${city.city}…`;

  return (
    // FULL-WIDTH BAR (no container here)
    <div className="w-full border-b border-gray-800 bg-black/60 backdrop-blur supports-[padding:max(0px)]">
      {/* Mobile: marquee scroll; Desktop: centered static */}
      <div className="py-2 text-xs sm:text-sm text-gray-100">
        <div className="block md:hidden ticker">
          <div className="px-3">{line}</div>
          <div className="px-3">{line}</div>
        </div>
        <div className="hidden md:block px-4 md:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto truncate">{line}</div>
        </div>
      </div>
    </div>
  );
}
