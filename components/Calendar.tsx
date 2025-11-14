'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCityFromHost } from '@/lib/cities';

type ApiEvent = {
  id?: string;
  title?: string;
  start?: string;
  end?: string | null;
  venue?: string | null;
  address?: string | null;
  url?: string | null;
  source?: string | null;
  free?: boolean | null;
};

type DaySummary = {
  date: string; // YYYY-MM-DD
  tops: ApiEvent[]; // first event to show in the cell
  moreCount: number; // how many extra events beyond the tops
};

/** Small helpers */

function pad2(n: number) {
  return n < 10 ? '0' + n : String(n);
}

function localYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  // last day of month
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, m: number) {
  return new Date(d.getFullYear(), d.getMonth() + m, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function weekdayShort(i: number) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
}

/** Normalization / dedupe helpers (copied from your previous logic) */

function norm(s?: string | null) {
  if (!s) return '';
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isJunkEvent(e: ApiEvent) {
  const t = norm(e.title);
  if (!t) return true;
  if (t === 'example event title') return true;
  if (/^(example|sample|test)\s+event/.test(t)) return true;
  return false;
}

function dedupeEventsClient(events: ApiEvent[]): ApiEvent[] {
  const seen = new Map<string, ApiEvent>();

  for (const e of events) {
    if (!e || !e.title || !e.start) continue;
    const ymd = localYmd(new Date(e.start));
    const titleKey = norm(e.title);
    const loc = norm(e.venue || e.address);
    const keyBase = `${titleKey}|${ymd}`;
    const key = loc ? `${keyBase}|${loc}` : keyBase;

    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, e);
      continue;
    }

    const prevTime = prev.start ? +new Date(prev.start) : Infinity;
    const nextTime = e.start ? +new Date(e.start) : Infinity;
    if (nextTime < prevTime) {
      seen.set(key, e);
    }
  }

  return Array.from(seen.values());
}

type CalendarProps = {
  id?: string;
  onRequestSubmitEvent?: (ymd?: string) => void;
};

export default function Calendar({ id, onRequestSubmitEvent }: CalendarProps) {
  const [host, setHost] = useState('');
  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(new Date()));

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // All events grouped by day: { '2025-11-10': [event, event...] }
  const [eventsByDay, setEventsByDay] = useState<Record<string, ApiEvent[]>>({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ApiEvent[]>([]);

  // Figure out which city we are (based on domain)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.hostname || '');
    }
  }, []);

  const city = getCityFromHost(host);

  // Fetch events for the current month from /api/events (server already filters by date)
  useEffect(() => {
    async function load() {
      const from = startOfMonth(activeMonth);
      const to = endOfMonth(activeMonth);

      const params = new URLSearchParams({
        start: from.toISOString(),
        end: to.toISOString(),
      });

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/events?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const raw = Array.isArray(data.events) ? (data.events as ApiEvent[]) : [];

        const cleaned = dedupeEventsClient(raw.filter((e) => !isJunkEvent(e)));

        // Group into days
        const map: Record<string, ApiEvent[]> = {};
        for (const e of cleaned) {
          if (!e.start) continue;
          const ymd = localYmd(new Date(e.start));
          if (!map[ymd]) map[ymd] = [];
          map[ymd].push(e);
        }

        // Sort by time inside each day
        for (const ymd of Object.keys(map)) {
          map[ymd].sort((a, b) => {
            const ta = a.start ? +new Date(a.start) : 0;
            const tb = b.start ? +new Date(b.start) : 0;
            return ta - tb;
          });
        }

        setEventsByDay(map);
      } catch (err) {
        console.error(err);
        setError("We couldn't load events for this month.");
        setEventsByDay({});
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [activeMonth]);

  // Build summaries used for the grid cells (tops + moreCount)
  const daySummaries = useMemo<Record<string, DaySummary>>(() => {
    const out: Record<string, DaySummary> = {};

    for (const [ymd, events] of Object.entries(eventsByDay)) {
      const tops = events.slice(0, 1);
      out[ymd] = {
        date: ymd,
        tops,
        moreCount: Math.max(0, events.length - tops.length),
      };
    }

    return out;
  }, [eventsByDay]);

  // 6x7 calendar grid
  const gridDates = useMemo(() => {
    const first = startOfMonth(activeMonth);
    const start = new Date(first);
    // Back up to Sunday
    start.setDate(first.getDate() - first.getDay());

    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [activeMonth]);

  const monthLabel = useMemo(
    () =>
      activeMonth.toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [activeMonth],
  );

  function openDay(ymd: string) {
    const events = eventsByDay[ymd] ?? [];
    setSelectedYmd(ymd);
    setSelectedEvents(events);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedYmd(null);
    setSelectedEvents([]);
  }

  // ESC to close modal
  useEffect(() => {
    if (!modalOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  return (
    <section
      id={id}
      className="mt-6 rounded-xl border border-gray-800 bg-black/40 p-4 md:p-6"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {city.city}, {city.state} — {monthLabel}
          </h2>
          <p className="text-sm text-gray-400">
            Click any day to see all events pulled from <code>events.json</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setActiveMonth((m) => addMonths(m, -1))}
            className="rounded border border-gray-700 px-2 py-1 text-sm hover:bg-gray-800"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setActiveMonth(startOfMonth(new Date()))}
            className="rounded border border-gray-700 px-3 py-1 text-sm hover:bg-gray-800"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setActiveMonth((m) => addMonths(m, +1))}
            className="rounded border border-gray-700 px-2 py-1 text-sm hover:bg-gray-800"
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => onRequestSubmitEvent?.()}
            className="ml-1 rounded border border-blue-600/70 bg-blue-600/10 px-3 py-1 text-sm font-medium text-blue-200 transition hover:bg-blue-600/20"
          >
            Submit Your Event
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Weekday header */}
      <div className="mt-4 grid grid-cols-7 gap-px text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="py-1">
            {weekdayShort(i)}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="mt-1 grid grid-cols-7 gap-px rounded-lg bg-gray-900/60">
        {gridDates.map((d) => {
          const ymd = localYmd(d);
          const inMonth = d.getMonth() === activeMonth.getMonth();
          const today = isSameDay(d, new Date());
          const summary = daySummaries[ymd];

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => openDay(ymd)}
              className={[
                'flex min-h-[110px] flex-col items-stretch bg-gray-950 p-2 text-left text-xs transition-colors',
                inMonth ? '' : 'opacity-40',
                today ? 'border border-blue-500' : 'border border-transparent',
                'hover:bg-gray-900',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold">{d.getDate()}</span>
                {summary && summary.moreCount > 0 && (
                  <span className="rounded bg-blue-900/50 px-2 py-0.5 text-[10px] text-blue-100">
                    +{summary.moreCount} more
                  </span>
                )}
              </div>

              <div className="mt-1 flex-1 space-y-1">
                {loading ? (
                  <span className="text-[11px] text-gray-500">Loading…</span>
                ) : summary && summary.tops.length > 0 ? (
                  summary.tops.map((ev) => (
                    <div
                      key={ev.id ?? `${ev.title}-${ev.start}`}
                      className="rounded bg-gray-800/70 px-1.5 py-1 text-[11px] leading-snug"
                    >
                      <div className="truncate font-medium">{ev.title}</div>
                      <div className="truncate text-[10px] text-gray-400">
                        {ev.start &&
                          new Date(ev.start).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        {ev.venue ? ` • ${ev.venue}` : ''}
                        {ev.source ? ` • ${ev.source}` : ''}
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-gray-600">No events.</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-xl border border-gray-700 bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
              <div className="text-sm font-semibold">
                {selectedYmd &&
                  new Date(selectedYmd + 'T00:00:00').toLocaleDateString(
                    undefined,
                    {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    },
                  )}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-4 py-3 text-sm">
              {selectedEvents.length === 0 && (
                <div className="text-gray-400">No events for this day.</div>
              )}

              {selectedEvents.length > 0 && (
                <ul className="space-y-3">
                  {selectedEvents.map((ev) => (
                    <li
                      key={ev.id ?? `${ev.title}-${ev.start}`}
                      className="rounded border border-gray-800 bg-gray-900/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{ev.title}</div>
                        {ev.free === true && (
                          <span className="rounded bg-green-800/60 px-2 py-0.5 text-[11px] text-green-100">
                            Free
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-300">
                        {ev.start &&
                          new Date(ev.start).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        {ev.end &&
                          `–${new Date(ev.end).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {ev.venue}
                        {ev.venue && ev.address ? ' • ' : ''}
                        {ev.address}
                        {ev.source ? ` • ${ev.source}` : ''}
                      </div>
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-medium text-blue-300 hover:underline"
                        >
                          View details / tickets ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
