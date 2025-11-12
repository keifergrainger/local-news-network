import path from "path";
import fs from "fs/promises";

export type EventItem = {
  id?: string;
  title?: string;
  start?: string;
  end?: string | null;
  url?: string | null;
  venue?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  [k: string]: any;
};

export function safeDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.valueOf()) ? null : d;
}

export function monthRangeUTC(y: number, m1to12: number) {
  const start = new Date(Date.UTC(y, m1to12 - 1, 1, 0, 0, 0));
  const nextM = m1to12 === 12 ? 1 : m1to12 + 1;
  const nextY = m1to12 === 12 ? y + 1 : y;
  const endOpen = new Date(Date.UTC(nextY, nextM - 1, 1, 0, 0, 0));
  const end = new Date(endOpen.getTime() - 1); // inclusive end
  return { start, end };
}

export function deriveRangeFromQuery(u: URL) {
  const get = (k: string) => u.searchParams.get(k) ?? undefined;
  let startQ = get("start") ?? get("from");
  let endQ   = get("end")   ?? get("to");
  const yearQ  = u.searchParams.get("year");
  const monthQ = u.searchParams.get("month");

  if (startQ && endQ) {
    const s = safeDate(startQ);
    const e = safeDate(endQ);
    if (s && e) return { start: s, end: e };
  }

  if (yearQ && monthQ) {
    const y = parseInt(yearQ, 10);
    const m = parseInt(monthQ, 10);
    if (y > 1900 && m >= 1 && m <= 12) return monthRangeUTC(y, m);
  }

  // default: current month UTC
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return monthRangeUTC(y, m);
}

export async function loadEvents(): Promise<EventItem[]> {
  const file = path.join(process.cwd(), "public", "events.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as EventItem[]) : [];
  } catch {
    return [];
  }
}
