'use client';

import { useEffect, useMemo, useState } from 'react';
import EventCard, { LocalEvent } from '@/components/EventCard';
import { getCityFromHost } from '@/lib/cities';

export default function EventsPage() {
  const [host, setHost] = useState('');
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [debug, setDebug] = useState<{ from?: string; to?: string; count?: number }>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.hostname);
    }
  }, []);
  const city = getCityFromHost(host);

  const from = useMemo(() => new Date(), []);
  const to = useMemo(() => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), []);

  useEffect(() => {
    async function load() {
      if (!city?.host) return;

      const params = new URLSearchParams({
        cityHost: city.host,
        start: from.toISOString(),
        end: to.toISOString(),
      });

      try {
        const res = await fetch(`/api/events?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const list = Array.isArray(data.events) ? (data.events as LocalEvent[]) : [];
        setEvents(list);
        setDebug({ from: data.from, to: data.to, count: data.count });
      } catch (err) {
        console.error('Failed to load events', err);
        setEvents([]);
        setDebug({});
      }
    }

    load();
  }, [city.host, from, to]);

  return (
    <div className="container py-6 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Upcoming Events</h1>
      <p className="text-gray-300 mb-5">City-wide events in {city.city}, {city.state}.</p>
      <p className="text-xs text-gray-500 mb-4">Range: {debug.from?.slice(0, 10)} → {debug.to?.slice(0, 10)} · Found: {debug.count ?? 0}</p>
      {events.length === 0 && <div className="card">No events yet for this range.</div>}
      <div className="grid gap-4">
        {events.map((e) => (
          <EventCard key={e.id} e={e} />
        ))}
      </div>
    </div>
  );
}
