'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';

type ApiEvent = {
  id: string;
  title: string;
  start: string;  // ISO
  end?: string;
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
};

type DaySummary = {
  date: string;       // YYYY-MM-DD (local)
  tops: ApiEvent[];   // 1 or 2 (sports/concerts prioritized)
  moreCount: number;  // remaining events not included in tops (estimate before exact fetch)
};

/* ---------- tiny date utils ---------- */
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, m: number) { return new Date(d.getFullYear(), d.getMonth() + m, d.getDate()); }
function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** convert ISO to local YYYY-MM-DD (matches server’s dayKeyLocal) */
function isoToLocalYMD(iso: string) {
  const d = new Date(iso);
  return formatYMD(d);
}

const WINDOW_MONTHS_AHEAD = 2;

export default function Calendar() {
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [daysSummary, setDaysSummary] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [host, setHost] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // cache of exact per-day lists and totals
  const [dayEvents, setDayEvents] = useState<Record<string, ApiEvent[] | 'loading' | 'error'>>({});
  const [dayTotals, setDayTotals] = useState<Record<string, number>>({});

  useEffect(() => { if (typeof window !== 'undefined') setHost(window.location.hostname); }, []);
  const city = getCityFromHost(host);

  async function fetchSummary(anchorMonth: Date) {
    try {
      setLoading(true);
      const from = startOfMonth(anchorMonth);
      const to = endOfMonth(addMonths(anchorMonth, WINDOW_MONTHS_AHEAD));
      const url = `/api/events?host=${encodeURIComponent(city.host)}&from=${formatYMD(from)}&to=${formatYMD(to)}`;
      // use no-store so we don’t get stale results that disagree with day fetch
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      setDaysSummary(Array.isArray(data.days) ? data.days : []);
    } catch {
      setDaysSummary([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (city) fetchSummary(visibleMonth); /* eslint-disable */ }, [city?.host]);
  useEffect(() => { if (city) fetchSummary(visibleMonth); /* eslint-disable */ }, [visibleMonth.getFullYear(), visibleMonth.getMonth()]);

  const summaryByDate = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const d of daysSummary) map.set(d.date, d);
    return map;
  }, [daysSummary]);

  const daysGrid = useMemo(() => {
    const start = startOfMonth(visibleMonth);
    const end = endOfMonth(visibleMonth);
    const startIdx = start.getDay();
    const endIdx = end.getDay();
    const gridStart = new Date(start); gridStart.setDate(start.getDate() - startIdx);
    const gridEnd   = new Date(end);   gridEnd.setDate(end.getDate() + (6 - endIdx));
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      cells.push({ date: new Date(d), inMonth: d.getMonth() === visibleMonth.getMonth() });
    }
    return cells;
  }, [visibleMonth]);

  const today = new Date();

  /**
   * Load the exact per-day list.
   * - Primary: /api/events/[date] (already deduped & local-day filtered by server)
   * - Fallback: /api/events?full=1 and filter by LOCAL day on client
   */
  async function ensureDayLoaded(dateStr: string) {
    // if we already have an array (even empty), don’t refetch
    if (Array.isArray(dayEvents[dateStr])) return;

    setDayEvents(prev => ({ ...prev, [dateStr]: 'loading' }));
    try {
      const res = await fetch(`/api/events/${dateStr}?host=${encodeURIComponent(city.host)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const list: ApiEvent[] = Array.isArray(json.events) ? json.events : [];
      setDayEvents(prev => ({ ...prev, [dateStr]: list }));
      setDayTotals(prev => ({ ...prev, [dateStr]: list.length }));
    } catch {
      try {
        const res2 = await fetch(
          `/api/events?full=1&host=${encodeURIComponent(city.host)}&from=${dateStr}&to=${dateStr}`,
          { cache: 'no-store' }
        );
        const json2 = await res2.json();
        const all: ApiEvent[] = Array.isArray(json2.events) ? json2.events : [];
        // IMPORTANT: filter by LOCAL day (not UTC slice)
        const list = all.filter(e => isoToLocalYMD(e.start) === dateStr);
        setDayEvents(prev => ({ ...prev, [dateStr]: list }));
        setDayTotals(prev => ({ ...prev, [dateStr]: list.length }));
      } catch {
        setDayEvents(prev => ({ ...prev, [dateStr]: 'error' }));
      }
    }
  }

  return (
    <div className="card p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">
            {visibleMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <p className="text-xs md:text-sm text-gray-400">
            Showing events through {addMonths(visibleMonth, WINDOW_MONTHS_AHEAD).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                  onClick={() => setVisibleMonth(prev => startOfMonth(addMonths(prev, -1)))} aria-label="Previous month">‹</button>
          <button className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                  onClick={() => setVisibleMonth(startOfMonth(new Date()))}>Today</button>
          <button className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                  onClick={() => setVisibleMonth(prev => startOfMonth(addMonths(prev, 1)))} aria-label="Next month">›</button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 text-[11px] md:text-xs text-gray-400 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="px-1 py-1 text-center">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-[2px] md:gap-1">
        {daysGrid.map(({ date, inMonth }) => {
          const key = formatYMD(date);
          const s = summaryByDate.get(key);
          const isToday = sameDay(date, today);

          // Estimated total from summary; override with exact total once fetched for that day
          const estimatedTotal = s ? s.tops.length + s.moreCount : 0;
          const exactTotal = dayTotals[key];
          const totalForBadge = exactTotal !== undefined ? exactTotal : estimatedTotal;

          // "+N more" text = total - number of lines rendered in the cell (tops length)
          const shownLines = s?.tops?.length ?? 0;
          const moreCount = Math.max(0, (exactTotal !== undefined ? exactTotal : estimatedTotal) - shownLines);

          return (
            <button
              key={key}
              onClick={async () => {
                setSelectedDate(date);
                await ensureDayLoaded(key);
              }}
              className={[
                "rounded-lg border text-left px-2 py-1 md:px-2 md:py-2 transition",
                "min-h-[64px] md:min-h-[80px]",
                inMonth ? "bg-gray-900/60 border-gray-800" : "bg-gray-900/30 border-gray-800/50",
                isToday ? "ring-1 ring-accent/60" : ""
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] md:text-xs ${inMonth ? "text-gray-200" : "text-gray-500"}`}>{date.getDate()}</span>
                {!!totalForBadge && (
                  <span className="text-[10px] md:text-[11px] px-2 py-[2px] rounded bg-gray-800 border border-gray-700 text-gray-200">
                    {totalForBadge}
                  </span>
                )}
              </div>

              {/* Up to two priority lines (sports/concerts) from the summary */}
              {s?.tops?.length ? (
                <div className="mt-1 space-y-1">
                  {s.tops.slice(0, 2).map(ev => (
                    <div key={ev.id} className="truncate text-[10px] md:text-[11px] text-gray-100 font-medium">
                      • {ev.title}
                    </div>
                  ))}
                  {moreCount > 0 && (
                    <div className="text-[10px] text-gray-500">+{moreCount} more</div>
                  )}
                </div>
              ) : (
                <div className="mt-1 text-[10px] text-gray-500">No events</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 text-xs text-gray-400">
        {loading ? "Loading events…" : `${daysSummary.length} days loaded in 3-month window`}
      </div>

      {/* Drawer (always shows the exact per-day list when available) */}
      {selectedDate && (
        <div className="mt-4 p-3 rounded-xl bg-gray-900/70 border border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold">
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <button className="text-xs text-gray-400 hover:text-gray-200" onClick={() => setSelectedDate(null)}>Close</button>
          </div>

          {(() => {
            const key = formatYMD(selectedDate);
            const state = dayEvents[key];
            if (state === 'loading') return <div className="mt-2 text-xs text-gray-500">Loading…</div>;
            if (state === 'error')   return <div className="mt-2 text-xs text-red-400">Couldn’t load events for this day.</div>;

            // Prefer full exact list; if not fetched (shouldn’t happen after click), show summary tops as a fallback
            const s = summaryByDate.get(key);
            const list: ApiEvent[] = Array.isArray(state) ? state : (s?.tops ?? []);
            const sorted = [...list].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            return (
              <div className="mt-2 space-y-2">
                {sorted.length > 0 ? sorted.map(ev => (
                  <a key={ev.id}
                     className="block rounded-lg border border-gray-800 bg-gray-900/60 p-3 hover:bg-gray-900/80"
                     href={ev.url || '#'} target="_blank" rel="noreferrer">
                    <div className="text-sm font-medium">{ev.title}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {ev.venue ? ` • ${ev.venue}` : ''}{ev.source ? ` • ${ev.source}` : ''}
                    </div>
                  </a>
                )) : (
                  <div className="text-xs text-gray-500">No events for this day.</div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
