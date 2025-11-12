'use client';
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;

  const p = path.join(process.cwd(), "public", "events.json");
  let items: any[] = [];
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    return NextResponse.json([], { status: 200 });
  }

  // Date filter
  if (start || end) {
    items = items.filter((e) => {
      const s = e?.start ? new Date(e.start) : null;
      if (!s || Number.isNaN(+s)) return false;
      if (start && s < start) return false;
      if (end && s > end) return false;
      return true;
    });
  }

  const byDay = new Map<string, number>();
  for (const e of items) {
    const d = e?.start ? new Date(e.start) : null;
    if (!d || Number.isNaN(+d)) continue;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const out = Array.from(byDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return NextResponse.json(out, { status: 200 });
}

