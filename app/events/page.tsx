'use client';
import { useEffect, useMemo, useState } from 'react';
import EventCard, { LocalEvent } from '@/components/EventCard';
import { getCityFromHost } from '@/lib/cities';

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function EventsPage() {
  const [host, setHost] = useState('');
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [debug, setDebug] = useState<{from?: string; to?: string; count?: number}>({});

  useEffect(() => { if (typeof window !== 'undefined') setHost(window.location.hostname); }, []);
  const city = getCityFromHost(host);

  const from = useMemo(() => new Date(), []);
  const to = useMemo(() => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!city?.host) return;
      const qs = new URLSearchParams({ cityHost: city.host, from: ymd(from), to: ymd(to) }).toString();
      try {
        const res = await fetch(`/api/events-local?${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data: any = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(data?.events) ? (data.events as LocalEvent[]) : [];
        setEvents(list);
        setDebug({ from: data?.from, to: data?.to, count: data?.count ?? list.length });
      } catch {
        if (cancelled) return;
        setEvents([]);
        setDebug({});
      }
    }
    load();
    return () => { cancelled = true; };
  }, [city.host, from, to]);

  return (
    <div className="container py-6 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Upcoming Events</h1>
      <p className="text-gray-300 mb-5">City-wide events in {city.city}, {city.state}.</p>
      <p className="text-xs text-gray-500 mb-4">Range: {debug.from?.slice(0,10)} â†’ {debug.to?.slice(0,10)} Â· Found: {debug.count ?? 0}</p>
      {events.length === 0 && <div className="card">No events yet for this range.</div>}
      <div className="grid gap-4">
        {events.map(e => (<EventCard key={e.id} e={e} />))}
      </div>
    </div>
  );
}

