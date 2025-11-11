'use client';
import { useEffect, useMemo, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';
import EventCard, { LocalEvent } from '@/components/EventCard';

type DayCell = {
  date: Date;
  inMonth: boolean;
  key: string; // YYYY-MM-DD
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Calendar() {
  const [host, setHost] = useState('');
  useEffect(() => { if (typeof window !== 'undefined') setHost(window.location.hostname); }, []);
  const city = getCityFromHost(host);

  // which month is shown
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  // events map -> date key => array of events
  const [eventsByDay, setEventsByDay] = useState<Record<string, LocalEvent[]>>({});
  // selected day (for modal/sheet)
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // fetch events for this city (next ~60 days, but the API already limits to 30)
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events?cityHost=${encodeURIComponent(city.host)}`, { cache: 'no-store' });
        const data = await res.json();
        const list: LocalEvent[] = Array.isArray(data.events) ? data.events : [];
        const map: Record<string, LocalEvent[]> = {};
        for (const ev of list) {
          const key = ymd(new Date(ev.start));
          if (!map[key]) map[key] = [];
          map[key].push(ev);
        }
        // sort each day by start time
        for (const k of Object.keys(map)) {
          map[k].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        }
        setEventsByDay(map);
      } catch (e) {
        console.error(e);
        setEventsByDay({});
      }
    }
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [city.host]);

  // Build 6x7 grid for the month (always 42 cells for consistent layout)
  const grid: DayCell[] = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    // find the Monday/Sunday start; using Sunday as first day (0)
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({
        date: d,
        inMonth: d.getMonth() === cursor.getMonth(),
        key: ymd(d),
      });
    }
    return cells;
  }, [cursor]);

  const monthTitle = cursor.toLocaleString([], { month: 'long', year: 'numeric' });
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <section className="container py-6 md:py-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-bold">Calendar — {monthTitle}</h2>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setCursor(addMonths(cursor, -1))}>← Prev</button>
          <button className="btn" onClick={() => setCursor(startOfMonth(new Date()))}>Today</button>
          <button className="btn" onClick={() => setCursor(addMonths(cursor, 1))}>Next →</button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-xs md:text-sm text-gray-400 mb-1">
        {weekdays.map(w => <div key={w} className="px-2 py-2">{w}</div>)}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-[2px] bg-gray-800/60 rounded-xl overflow-hidden">
        {grid.map((cell) => {
          const dayEvents = eventsByDay[cell.key] || [];
          const today = ymd(new Date()) === cell.key;
          return (
            <button
              key={cell.key}
              onClick={() => setSelectedKey(cell.key)}
              className={[
                'text-left p-2 min-h-[92px] sm:min-h-[110px] bg-gray-900/70 hover:bg-gray-900 transition',
                !cell.inMonth ? 'opacity-50' : '',
                today ? 'ring-1 ring-accent' : ''
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm text-gray-300">
                  {cell.date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="badge">{dayEvents.length}</span>
                )}
              </div>

              {/* Mini list preview (max 3) */}
              <ul className="mt-2 space-y-1">
                {dayEvents.slice(0, 3).map(ev => (
                  <li key={ev.id} className="text-[11px] sm:text-xs text-gray-200 line-clamp-1">
                    {ev.title}
                  </li>
                ))}
                {dayEvents.length > 3 && (
                  <li className="text-[11px] sm:text-xs text-gray-400">+{dayEvents.length - 3} more…</li>
                )}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Modal / Sheet for selected day */}
      {selectedKey && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedKey(null)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/70" />

          {/* sheet */}
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl bg-gray-900 border-t border-gray-800 p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg md:text-xl font-semibold">
                {new Date(selectedKey).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <button className="btn" onClick={() => setSelectedKey(null)}>Close</button>
            </div>

            <div className="grid gap-3">
              {(eventsByDay[selectedKey] || []).map(ev => (
                <EventCard key={ev.id} e={ev} />
              ))}
              {(eventsByDay[selectedKey] || []).length === 0 && (
                <div className="card">No events for this day.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
