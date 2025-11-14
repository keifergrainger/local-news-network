'use client';
import { useEffect, useMemo, useState } from "react";

type NewsItem = { title: string; link: string; source?: string; publishedAt: string };
type Weather = { chip: string | null };

export default function TopTicker() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [weather, setWeather] = useState<Weather>({ chip: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [n, w] = await Promise.all([
          fetch("/api/news", { cache: "no-store" }).then(r => r.json()).catch(() => ({ items: [] })),
          fetch("/api/weather", { cache: "no-store" }).then(r => r.json()).catch(() => ({ chip: null })),
        ]);
        if (!cancelled) {
          setNews(Array.isArray(n.items) ? n.items : []);
          setWeather({ chip: w?.chip ?? null });
        }
      } catch {}
    }
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const chips = useMemo(() => {
    const out: Array<{ type:"news"|"weather"; text:string; href?:string }> = [];
    if (news.length===0 && !weather.chip) return out;

    let insertedWeather = 0;
    for (let i=0;i<news.length;i++){
      const n = news[i];
      out.push({ type:"news", text:n.title, href:n.link });
      if ((i+1)%2===0 && weather.chip) out.push({ type:"weather", text: weather.chip });
    }
    if (weather.chip && !out.some(c=>c.type==="weather")) out.push({ type:"weather", text: weather.chip });
    return out.slice(0, 60);
  }, [news, weather]);

  if (chips.length === 0) return null;

  const loop = [...chips, ...chips];

  return (
    <div className="ticker-rail">
      <div className="ticker-track" aria-label="Local updates">
        {loop.map((c, i) => (
          <span key={i} className={`ticker-chip ${c.type==="weather"?"ticker-chip-weather":"ticker-chip-news"}`} title={c.text}>
            {c.type==="news" && c.href
              ? <a href={c.href} target="_blank" rel="noreferrer" className="hover:underline focus:outline-none whitespace-nowrap">{c.text}</a>
              : <span className="whitespace-nowrap">{c.text}</span>
            }
          </span>
        ))}
      </div>
    </div>
  );
}

