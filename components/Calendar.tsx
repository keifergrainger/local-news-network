'use client';
import { useEffect, useMemo, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';
import EventCard, { LocalEvent } from '@/components/EventCard';

type DayCell = { date: Date; inMonth: boolean; key: string };

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function Calendar() {
  const [host, setHost] = useState('');
  useEffect(() => { if (typeof window !== 'undefined') setHost(window.location.hostname); }, []);
  const city = getCityFromHost(host);

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [eventsByDay, setEventsByDay] = useState<Record<string, LocalEvent[]>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events?cityHost=${encodeURIComponent(city.host)}`, { cache: 'no-store' });
        const data = await res.json();
        const list: LocalEvent[] = Array.isArray(data.events) ? data.events : [];
        const map: Record<string, LocalEvent[]> = {};
        for (const ev of list) {
          const key = ymd(new Date(ev.start));
          (map[key] ||= []).push(ev);
        }
        for (const k of Object.keys(map)) {
          map[k].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        }
        setEventsByDay(map);
      } catch {
        setEventsByDay({});
      }
    }
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [city.host]);

  const grid: DayCell[] = useMemo(() => {
    const first = startOfMonth(cursor);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === cursor.getMonth(), key: ymd(d) });
    }
    return cells;
  }, [cursor]);

  const monthTitle = cursor.toLocaleString([], { month: 'long', year: 'numeric' });
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <section className="container py-4 md:py-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg md:text-xl font-bold">Calendar — {monthTitle}</h2>
        <div className="flex gap-2">
          <button className="btn px-3 py-1" onClick={() => setCursor(addMonths(cursor, -1))}>← Prev</button>
          <button className="btn px-3 py-1" onClick={() => setCursor(startOfMonth(new Date()))}>Today</button>
          <button className="btn px-3 py-1" onClick={() => setCursor(addMonths(cursor, 1))}>Next →</button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-[11px] md:text-xs text-gray-400 mb-1">
        {weekdays.map(w => <div key={w} className="px-1 py-1">{w}</div>)}
      </div>

      {/* Compact month grid */}
      <div className="grid grid-cols-7 gap-[2px] bg-gray-800/60 rounded-xl overflow-hidden">
        {grid.map((cell) => {
          const dayEvents = eventsByDay[cell.key] || [];
          const today = ymd(new Date()) === cell.key;
          return (
            <button
              key={cell.key}
              onClick={() => setSelectedKey(cell.key)}
              className={[
                'text-left p-1.5 sm:p-2 min-h-[64px] sm:min-h-[84px] bg-gray-900/70 hover:bg-gray-900 transition',
                !cell.inMonth ? 'opacity-50' : '',
                today ? 'ring-1 ring-accent' : ''
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs text-gray-300">{cell.date.getDate()}</span>
                {dayEvents.length > 0 && <span className="badge">{dayEvents.length}</span>}
              </div>
              <ul className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => (
                  <li key={ev.id} className="text-[10px] sm:text-[11px] text-gray-200 line-clamp-1">
                    {ev.title}
                  </li>
                ))}
                {dayEvents.length > 2 && (
                  <li className="text-[10px] sm:text-[11px] text-gray-400">+{dayEvents.length - 2} more…</li>
                )}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Bottom sheet for the selected day */}
      {selectedKey && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" onClick={() => setSelectedKey(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl bg-gray-900 border-t border-gray-800 p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base md:text-lg font-semibold">
                {new Date(selectedKey).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <button className="btn px-3 py-1" onClick={() => setSelectedKey(null)}>Close</button>
            </div>
            <div className="grid gap-2">
              {(eventsByDay[selectedKey] || []).map(ev => (<EventCard key={ev.id} e={ev} />))}
              {(eventsByDay[selectedKey] || []).length === 0 && <div className="card">No events for this day.</div>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
