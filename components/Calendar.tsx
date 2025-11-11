// components/Calendar.tsx
"use client";

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
  date: string;
  tops: ApiEvent[];
  moreCount: number;
};

function pad2(n: number) { return String(n).padStart(2, "0"); }
function localYmd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, m: number) { return new Date(d.getFullYear(), d.getMonth() + m, Math.min(d.getDate(), 28)); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function weekdayShort(i: number) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]; }

export default function Calendar() {
  const [host, setHost] = useState<string>("");
  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, DaySummary>>({});

  useEffect(() => {
    if (typeof window !== "undefined") setHost(window.location.hostname || "");
  }, []);
  const city = getCityFromHost(host);

  useEffect(() => {
    const from = startOfMonth(activeMonth);
    const to = endOfMonth(activeMonth);
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString();

    setLoading(true);
    setError(null);
    fetch(`/api/events/summary?${qs}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((json: { days?: DaySummary[] }) => {
        const map: Record<string, DaySummary> = {};
        for (const d of json.days || []) map[d.date] = d;
        setDays(map);
      })
      .catch(() => setError("We couldn’t load events for this month."))
      .finally(() => setLoading(false));
  }, [activeMonth]);

  const gridDates = useMemo(() => {
    const first = startOfMonth(activeMonth);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // start at Sunday
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

  return (
    <div className="rounded-2xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/60 border-b border-gray-800">
        <div className="text-lg font-semibold">
          {city.city}, {city.state} — {monthLabel}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => setActiveMonth((m) => addMonths(m, -1))} aria-label="Previous month">‹</button>
          <button className="btn btn-sm" onClick={() => setActiveMonth((m) => addMonths(m, +1))} aria-label="Next month">›</button>
        </div>
      </div>

      {error && <div className="px-4 py-3 text-sm text-red-400 border-b border-gray-800">{error}</div>}

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
          const summary = days[ymd];

          return (
            <div key={ymd} className={`bg-gray-950 p-3 min-h-28 ${inMonth ? "" : "opacity-40"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`text-xs ${today ? "px-2 py-0.5 rounded bg-blue-500/10 text-blue-300" : "text-gray-400"}`}>
                  {d.getDate()}
                </div>
                {summary && summary.moreCount > 0 && (
                  <div className="text-[11px] text-gray-400">+{summary.moreCount} more</div>
                )}
              </div>

              {loading ? (
                <div className="text-xs text-gray-500">Loading…</div>
              ) : summary && summary.tops.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {summary.tops.slice(0, 2).map((ev) => (
                    <a key={ev.id} href={ev.url || "#"} className="block text-xs hover:underline" target="_blank" rel="noreferrer">
                      <div className="truncate font-medium text-gray-200">{ev.title}</div>
                      <div className="truncate text-[11px] text-gray-500">
                        {new Date(ev.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        {ev.venue ? ` • ${ev.venue}` : ""}
                        {ev.source ? ` • ${ev.source}` : ""}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No events for this day.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
