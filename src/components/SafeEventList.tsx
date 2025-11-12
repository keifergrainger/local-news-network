import React from "react";
import type { EventItem } from "../types/EventItem";
import { inMonthUTC, groupByDayUTC, toDate, safeEnd } from "../lib/eventDateUtils";

export interface SafeEventListProps {
  items: EventItem[];
  year: number;          // e.g., 2025
  month: number;         // 1..12
  showOnlyMonth?: boolean; // default true
}

const formatTime = (d?: Date): string => {
  if (!d || !isFinite(d.getTime())) return "";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString();
  }
};

export default function SafeEventList(props: SafeEventListProps) {
  const showOnlyMonth = props.showOnlyMonth !== false;

  const filtered = showOnlyMonth
    ? props.items.filter((i) => inMonthUTC(i.start, props.year, props.month))
    : props.items.slice();

  // Guard against garbage inputs
  const sane = filtered.filter((i) => typeof i?.start === "string" && i.start.length > 0);

  const grouped = groupByDayUTC(sane);
  const days = Object.keys(grouped).sort(); // "YYYY-MM-DD" strings sort naturally

  if (days.length === 0) {
    return <div>No events found.</div>;
  }

  return (
    <div className="space-y-6">
      {days.map((day) => {
        const events = grouped[day].slice().sort((a, b) => {
          const sa = toDate(a.start)?.getTime() ?? 0;
          const sb = toDate(b.start)?.getTime() ?? 0;
          return sa - sb;
        });

        return (
          <div key={day} className="border rounded-xl p-4">
            <div className="font-semibold mb-2">{day}</div>
            <ul className="space-y-2">
              {events.map((ev) => {
                const start = toDate(ev.start);
                const end = safeEnd(ev.start, ev.end);
                const timeLabel =
                  start ? formatTime(start) + (end ? " – " + formatTime(end) : "") : "";

                return (
                  <li key={ev.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="min-w-0">
                      {ev.url ? (
                        <a href={ev.url} target="_blank" rel="noreferrer" className="underline">
                          {ev.title}
                        </a>
                      ) : (
                        <span>{ev.title}</span>
                      )}
                      {ev.venue ? <div className="text-sm opacity-80">{ev.venue}</div> : null}
                      {ev.address ? <div className="text-xs opacity-70">{ev.address}</div> : null}
                    </div>
                    <div className="text-sm opacity-80 shrink-0">{timeLabel}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
