'use client';
// components/Calendar.tsx
import { useEffect, useMemo, useState } from "react";
import { getCityFromHost } from "@/lib/cities";

type ApiEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  venue?: string;
  address?: string;
  url?: string;
  source?: string;
  free?: boolean;
};

type DaySummary = {
  date: string;      // YYYY-MM-DD
  tops: ApiEvent[];  // up to 2
  moreCount: number;
};

/** Format helpers */
function pad2(n: number) { return n < 10 ? "0" + n : String(n); }
function localYmd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addMonths(d: Date, m: number) { return new Date(d.getFullYear(), d.getMonth() + m, Math.min(d.getDate(), 28)); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function weekdayShort(i: number) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]; }

/** Normalization (ES5-safe) */
function norm(s?: string) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Drop obvious placeholder/dummy events (why: ICS/test feeds pollute lists) */
function isJunkEvent(e: ApiEvent) {
  const t = norm(e.title);
  if (!t) return true;
  if (t === "example event title") return true;
  if (/^(example|sample|test)\s+event/.test(t)) return true;
  return false;
}

/** Dedupe across sources; fall back to title+day if location is weak */
function dedupeEventsClient(events: ApiEvent[]): ApiEvent[] {
  const seen = new Map<string, ApiEvent>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e || !e.title || !e.start) continue;
    const ymd = localYmd(new Date(e.start));
    const titleKey = norm(e.title);
    const loc = norm(e.venue || e.address);
    const keyBase = `${titleKey}|${ymd}`;
    // why: many ICS duplicates have missing/noisy location; fallback collapses them
    const key = loc ? `${keyBase}|${loc}` : keyBase;
    if (!seen.has(key)) seen.set(key, e);
  }
  return Array.from(seen.values());
}

const DEFAULT_HOST = "saltlakeut.com";

export default function Calendar() {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, DaySummary>>({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<ApiEvent[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = window.location.hostname || "";
    const resolved = getCityFromHost(current);
    setHost(resolved?.host || DEFAULT_HOST);
  }, []);
  const city = getCityFromHost(host || DEFAULT_HOST);

  // Fetch month summary (tops + moreCount)
  useEffect(() => {
    if (!city?.host) return;
    const from = startOfMonth(activeMonth);
    const to = endOfMonth(activeMonth);
    const qs = new URLSearchParams({
      cityHost: city.host,
      from: from.toISOString(),
      to: to.toISOString(),
    }).toString();

    setLoading(true);
    setError(null);
    fetch(`/api/events-local/summary?${qs}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((json: { days?: DaySummary[] }) => {
        const map: Record<string, DaySummary> = {};
        for (const d of json.days || []) map[d.date] = d;
        setDays(map);
      })
      .catch(() => setError("We couldn’t load events for this month."))
      .finally(() => setLoading(false));
  }, [activeMonth, city.host]);

  // 6x7 grid
  const gridDates = useMemo(() => {
    const first = startOfMonth(activeMonth);
    const start = new Date(first);
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
    () => activeMonth.toLocaleString(undefined, { month: "long", year: "numeric" }),
    [activeMonth]
  );

  function openDay(ymd: string) {
    setSelectedYmd(ymd);
    setModalOpen(true);
    setDayLoading(true);
    setDayError(null);
    const fromDate = new Date(`${ymd}T00:00:00`);
    const toDate = new Date(`${ymd}T23:59:59.999`);
    const qs = new URLSearchParams({
      cityHost: city.host,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    }).toString();

    fetch(`/api/events-local?${qs}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((json: { events?: ApiEvent[] }) => {
        const all = Array.isArray(json.events) ? json.events : [];
        const cleaned = all.filter((e) => !isJunkEvent(e));              // <- filter junk first
        const deduped = dedupeEventsClient(cleaned)                      // <- strong dedupe
          .sort((a, b) => +new Date(a.start) - +new Date(b.start));
        setDayEvents(deduped);
      })
      .catch(() => setDayError("Couldn’t load events for this day."))
      .finally(() => setDayLoading(false));
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedYmd(null);
    setDayEvents([]);
    setDayError(null);
    setDayLoading(false);
  }

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  return (
    <div className="rounded-2xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/60 border-b border-gray-800">
        <div className="text-lg font-semibold">{city.city}, {city.state} — {monthLabel}</div>
        <div className="flex gap-2">
          <button
            className="btn btn-sm"
            onClick={() => setActiveMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
            title="Previous month"
          >
            ‹
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setActiveMonth((m) => addMonths(m, +1))}
            aria-label="Next month"
            title="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-red-400 border-b border-gray-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-7 gap-px bg-gray-800">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`wd-${i}`} className="bg-gray-950 px-3 py-2 text-xs font-medium text-gray-300 sticky top-0 z-10">
            {weekdayShort(i)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-800">
        {gridDates.map((d) => {
          const ymd = localYmd(d);
          const inMonth = d.getMonth() === activeMonth.getMonth();
          const today = isSameDay(d, new Date());
          const summary = inMonth ? days[ymd] : undefined;
          const showLoading = loading && inMonth;
          const hasEvents = !!summary && summary.tops.length > 0;

          return (
            <div
              key={ymd}
              role={inMonth ? "button" : undefined}
              tabIndex={inMonth ? 0 : -1}
              onClick={() => { if (inMonth) openDay(ymd); }}
              onKeyDown={(e) => { if (inMonth && (e.key === "Enter" || e.key === " ")) openDay(ymd); }}
              className={`bg-gray-950 p-3 min-h-28 ${inMonth ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500" : "cursor-default opacity-40"}`}
              aria-label={inMonth ? `Open events for ${ymd}` : undefined}
              title={inMonth ? `Open events for ${ymd}` : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`text-xs ${today ? "px-2 py-0.5 rounded bg-blue-500/10 text-blue-300" : "text-gray-400"}`}>
                  {d.getDate()}
                </div>
                {summary && summary.moreCount > 0 && (
                  <div className="text-[11px] text-gray-400">+{summary.moreCount} more</div>
                )}
              </div>

              {showLoading ? (
                <div className="text-xs text-gray-500">Loading…</div>
              ) : hasEvents ? (
                <div className="flex flex-col gap-1">
                  {summary.tops.slice(0, 2).map((ev) => (
                    <a
                      key={ev.id}
                      href={ev.url || "#"}
                      className="block text-xs hover:underline"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="truncate font-medium text-gray-200">{ev.title}</div>
                      <div className="truncate text-[11px] text-gray-500">
                        {new Date(ev.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        {ev.venue ? ` • ${ev.venue}` : ""}
                        {ev.source ? ` • ${ev.source}` : ""}
                      </div>
                    </a>
                  ))}
                </div>
              ) : inMonth ? (
                <div className="text-xs text-gray-500">No events for this day.</div>
              ) : (
                <div className="text-xs text-gray-500 opacity-0" aria-hidden="true">
                  No events for this day.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative w-full sm:max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-gray-950 border border-gray-800 shadow-xl m-0 sm:m-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="text-sm text-gray-400">
                {selectedYmd
                  ? new Date(selectedYmd + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short", month: "short", day: "numeric", year: "numeric",
                    })
                  : ""}
              </div>
              <button className="btn btn-sm" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <div className="p-4 overflow-auto">
              {dayLoading && <div className="text-sm text-gray-500">Loading all events…</div>}
              {dayError && <div className="text-sm text-red-400">{dayError}</div>}
              {!dayLoading && !dayError && dayEvents.length === 0 && (
                <div className="text-sm text-gray-500">No events for this day.</div>
              )}
              {!dayLoading && !dayError && dayEvents.length > 0 && (
                <ul className="space-y-3">
                  {dayEvents.map((ev) => (
                    <li key={ev.id} className="rounded-lg border border-gray-800 p-3 hover:border-gray-700">
                      <a href={ev.url || "#"} target="_blank" rel="noreferrer" className="block">
                        <div className="font-medium text-gray-100 truncate">{ev.title}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {new Date(ev.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          {ev.end ? `–${new Date(ev.end).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
                          {ev.venue ? ` • ${ev.venue}` : ""}
                          {ev.address ? ` • ${ev.address}` : ""}
                          {ev.source ? ` • ${ev.source}` : ""}
                          {ev.free === true ? " • Free" : ""}
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


