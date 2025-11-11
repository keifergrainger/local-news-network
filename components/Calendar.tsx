'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';

type ApiEvent = {
  id: string;
  title: string;
  start: string;     // ISO
  end?: string;
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
};

// -------- date helpers (no libs) ----------
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, m: number) {
  return new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
}
function formatYMD(d: Date) {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// -------- Calendar component ----------
export default function Calendar() {
  // which month is visible in the header/grid
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  // the events we’ve fetched for a wide future window
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setHost(window.location.hostname);
  }, []);
  const city = getCityFromHost(host);

  // Always fetch a wide range: visible month start -> +6 months
  async function fetchRangeForMonth(anchorMonth: Date) {
    try {
      setLoading(true);
      const from = startOfMonth(anchorMonth);
      const to = endOfMonth(addMonths(anchorMonth, 5)); // total window ≈ 6 months
      const url = `/api/events?host=${encodeURIComponent(city.host)}&from=${formatYMD(from)}&to=${formatYMD(to)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      console.error(e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    if (!city) return;
    fetchRangeForMonth(visibleMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.host]);

  // when user changes the visible month, fetch that month -> +6 months
  useEffect(() => {
    if (!city) return;
    fetchRangeForMonth(visibleMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth.getFullYear(), visibleMonth.getMonth()]);

  // bucket events by day for fast lookup
  const eventsByDay = useMemo(() => {
    const map = new Map<string, ApiEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.start);
      const key = formatYMD(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  // build day cells for the current visible month (shows previous/next spillover days so the grid is full)
  const days = useMemo(() => {
    const start = startOfMonth(visibleMonth);
    const end = endOfMonth(visibleMonth);

    // weekday index: 0=Sun..6=Sat
    const startIdx = start.getDay();
    const endIdx = end.getDay();

    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startIdx);

    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + (6 - endIdx));

    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      cells.push({ date: new Date(d), inMonth: d.getMonth() === visibleMonth.getMonth() });
    }
    return cells;
  }, [visibleMonth]);

  const today = new Date();

  return (
    <div className="card p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">
            {visibleMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <p className="text-xs md:text-sm text-gray-400">
            Showing events through {addMonths(visibleMonth, 5).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm"
            onClick={() => setVisibleMonth(prev => startOfMonth(addMonths(prev, -1)))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm"
            onClick={() => setVisibleMonth(startOfMonth(new Date()))}
          >
            Today
          </button>
          <button
            className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm"
            onClick={() => setVisibleMonth(prev => startOfMonth(addMonths(prev, 1)))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 text-[11px] md:text-xs text-gray-400 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="px-1 py-1 text-center">{d}</div>
        ))}
      </div>

      {/* Calendar grid — compact, mobile-first */}
      <div className="grid grid-cols-7 gap-[2px] md:gap-1">
        {days.map(({ date, inMonth }) => {
          const key = formatYMD(date);
          const dayEvents = eventsByDay.get(key) || [];
          const isToday = sameDay(date, today);

          return (
            <button
              key={key}
              onClick={() => setSelectedDate(date)}
              className={[
                "rounded-lg border text-left px-2 py-1 md:px-2 md:py-2 transition",
                "min-h-[70px] md:min-h-[84px]",                      // ≈ half-height vs earlier big version
                inMonth ? "bg-gray-900/60 border-gray-800" : "bg-gray-900/30 border-gray-800/50",
                isToday ? "ring-1 ring-accent/60" : ""
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] md:text-xs ${inMonth ? "text-gray-200" : "text-gray-500"}`}>
                  {date.getDate()}
                </span>
                {!!dayEvents.length && (
                  <span className="text-[10px] md:text-[11px] px-2 py-[2px] rounded bg-gray-800 border border-gray-700 text-gray-200">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* up to 3 tiny lines for preview */}
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map(ev => (
                  <div key={ev.id} className="truncate text-[10px] md:text-[11px] text-gray-300">
                    • {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-gray-500">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer status */}
      <div className="mt-3 text-xs text-gray-400">
        {loading ? "Loading events…" : `${events.length} events loaded in view window`}
      </div>

      {/* Selected day drawer */}
      {selectedDate && (
        <div className="mt-4 p-3 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold">
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <button
              className="text-xs text-gray-400 hover:text-gray-200"
              onClick={() => setSelectedDate(null)}
            >
              Close
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {(eventsByDay.get(formatYMD(selectedDate)) || []).map(ev => (
              <a
                key={ev.id}
                className="block rounded-lg border border-gray-800 bg-gray-900/60 p-3 hover:bg-gray-900/80"
                href={ev.url || '#'}
                target="_blank"
                rel="noreferrer"
              >
                <div className="text-sm font-medium">{ev.title}</div>
                <div className="text-xs text-gray-400">
                  {new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  {ev.venue ? ` • ${ev.venue}` : ''}
                </div>
              </a>
            ))}
            {!(eventsByDay.get(formatYMD(selectedDate)) || []).length && (
              <div className="text-xs text-gray-500">No events for this day.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
