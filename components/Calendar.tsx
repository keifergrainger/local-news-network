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
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, m: number) { return new Date(d.getFullYear(), d.getMonth() + m, Math.min(d.getDate(), 28)); }
function weekdayShort(i: number) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]; }

const DAY_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
const WEEKDAY_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
const DATETIME_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function ensureDayFormatter(timeZone: string) {
  let fmt = DAY_FMT_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    DAY_FMT_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

function ensureWeekdayFormatter(timeZone: string) {
  let fmt = WEEKDAY_FMT_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
    WEEKDAY_FMT_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

function ensureDateTimeFormatter(timeZone: string) {
  let fmt = DATETIME_FMT_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    DATETIME_FMT_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

function ymdInTimeZone(date: Date, timeZone: string) {
  const fmt = ensureDayFormatter(timeZone);
  const parts = fmt.formatToParts(date);
  let year = "0000";
  let month = "00";
  let day = "00";
  for (const part of parts) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
  }
  return `${year}-${month}-${day}`;
}

function weekdayInTimeZone(date: Date, timeZone: string) {
  const fmt = ensureWeekdayFormatter(timeZone);
  const label = fmt.format(date).slice(0, 3);
  return WEEKDAY_INDEX[label] ?? 0;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const fmt = ensureDateTimeFormatter(timeZone);
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    map[part.type] = part.value;
  }
  const utcValue = Date.UTC(
    Number(map.year ?? date.getUTCFullYear()),
    Number(map.month ?? date.getUTCMonth() + 1) - 1,
    Number(map.day ?? date.getUTCDate()),
    Number(map.hour ?? 0),
    Number(map.minute ?? 0),
    Number(map.second ?? 0)
  );
  return utcValue - date.getTime();
}

function startOfDayUtc(ymd: string, timeZone: string) {
  const [y, m, d] = ymd.split("-").map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const approx = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(approx, timeZone);
  return new Date(approx.getTime() - offset);
}

function endOfDayUtc(ymd: string, timeZone: string) {
  const start = startOfDayUtc(ymd, timeZone);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function utcDayKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function monthBoundariesUtc(date: Date, timeZone: string) {
  const first = startOfMonth(date);
  const year = first.getFullYear();
  const monthIndex = first.getMonth();
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  const month = monthIndex + 1;
  const monthStr = pad2(month);
  const yearStr = String(year);
  const lastDay = new Date(year, month, 0).getDate();
  const start = startOfDayUtc(`${yearStr}-${monthStr}-01`, timeZone);
  const end = endOfDayUtc(`${yearStr}-${monthStr}-${pad2(lastDay)}`, timeZone);
  if (!start || !end) return null;
  return { start, end };
}

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
    const ymd = utcDayKey(new Date(e.start));
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
  const timeZone = city.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const monthRange = useMemo(() => monthBoundariesUtc(activeMonth, timeZone), [activeMonth, timeZone]);

  // Fetch month summary (tops + moreCount)
  useEffect(() => {
    if (!city?.host) return;
    const fallbackStart = startOfMonth(activeMonth);
    const fallbackEnd = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    const from = monthRange?.start ?? fallbackStart;
    const to = monthRange?.end ?? fallbackEnd;
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
  }, [activeMonth, city.host, monthRange, timeZone]);

  // 6x7 grid
  const gridDates = useMemo(() => {
    const monthStart = monthRange?.start ?? startOfMonth(activeMonth);
    const offset = weekdayInTimeZone(monthStart, timeZone);

    if (monthRange?.start) {
      const gridStart = new Date(monthRange.start);
      gridStart.setUTCDate(gridStart.getUTCDate() - offset);
      const baseDay = gridStart.getUTCDate();
      const list: Date[] = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart);
        d.setUTCDate(baseDay + i);
        list.push(d);
      }
      return list;
    }

    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - offset);
    const list: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      list.push(d);
    }
    return list;
  }, [activeMonth, monthRange, timeZone]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone,
        month: "long",
        year: "numeric",
      }).format(activeMonth),
    [activeMonth, timeZone]
  );

  const activeMonthKey = useMemo(
    () => `${activeMonth.getFullYear()}-${pad2(activeMonth.getMonth() + 1)}`,
    [activeMonth]
  );
  const todayKey = useMemo(() => ymdInTimeZone(new Date(), timeZone), [timeZone]);

  function openDay(ymd: string) {
    setSelectedYmd(ymd);
    setModalOpen(true);
    setDayLoading(true);
    setDayError(null);
    const fromDate = startOfDayUtc(ymd, timeZone);
    const toDate = endOfDayUtc(ymd, timeZone);
    if (!fromDate || !toDate) {
      setDayError("Couldn’t determine this day in the local time zone.");
      setDayLoading(false);
      return;
    }
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
          const ymd = ymdInTimeZone(d, timeZone);
          const inMonth = ymd.slice(0, 7) === activeMonthKey;
          const today = ymd === todayKey;
          const dayNumber = Number(ymd.slice(8, 10));
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
                  {Number.isFinite(dayNumber) ? dayNumber : d.getDate()}
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
                        {new Date(ev.start).toLocaleTimeString(undefined, { timeZone, hour: "numeric", minute: "2-digit" })}
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
                  ? (startOfDayUtc(selectedYmd, timeZone) ?? new Date(selectedYmd + "T00:00:00")).toLocaleDateString(
                      undefined,
                      {
                        timeZone,
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    )
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
                          {new Date(ev.start).toLocaleTimeString(undefined, { timeZone, hour: "numeric", minute: "2-digit" })}
                          {ev.end
                            ? `–${new Date(ev.end).toLocaleTimeString(undefined, {
                                timeZone,
                                hour: "numeric",
                                minute: "2-digit",
                              })}`
                            : ""}
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


