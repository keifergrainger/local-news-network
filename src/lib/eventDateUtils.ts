import type { EventItem } from "../types/EventItem";

export const toDate = (iso?: string) => {
  return iso ? new Date(iso) : undefined;
};

export const safeEnd = (startISO: string, endISO?: string, defaultHours: number = 2) => {
  const start = new Date(startISO);
  if (!isFinite(start.getTime())) {
    throw new Error("Invalid start date: " + startISO);
  }
  if (!endISO) {
    return new Date(start.getTime() + defaultHours * 60 * 60 * 1000);
  }
  const end = new Date(endISO);
  if (!isFinite(end.getTime())) {
    return new Date(start.getTime() + defaultHours * 60 * 60 * 1000);
  }
  return end;
};

export const dayKeyUTC = (iso: string): string => {
  const d = new Date(iso);
  if (!isFinite(d.getTime())) {
    throw new Error("Invalid ISO date: " + iso);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + dd; // "YYYY-MM-DD"
};

export const inMonthUTC = (iso: string, year: number, month1to12: number): boolean => {
  const d = new Date(iso);
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month1to12;
};

export const groupByDayUTC = (items: EventItem[]): Record<string, EventItem[]> => {
  return items.reduce((acc, it) => {
    const key = dayKeyUTC(it.start);
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {} as Record<string, EventItem[]>);
};
