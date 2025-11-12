import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

type Item = {
  id?: string;
  title?: string;
  start?: string;
  end?: string | null;
  url?: string | null;
  venue?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string | null;
};

function safeParseDate(s?: string | null): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return isFinite(t) ? t : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const startQS = url.searchParams.get("start");
  const endQS = url.searchParams.get("end");

  const startMs = startQS ? Date.parse(startQS) : Number.NEGATIVE_INFINITY;
  const endMs   = endQS   ? Date.parse(endQS)   : Number.POSITIVE_INFINITY;

  let raw = "";
  try {
    const filePath = path.join(process.cwd(), "public", "events.json");
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    // no file? return empty but valid JSON so the UI doesn't crash
    return NextResponse.json({ events: [], from: startQS, to: endQS, count: 0 });
  }

  let arr: Item[] = [];
  try {
    const parsed = JSON.parse(raw);
    arr = Array.isArray(parsed) ? (parsed as Item[]) : [];
  } catch {
    return NextResponse.json({ events: [], from: startQS, to: endQS, count: 0 });
  }

  // filter by requested window if present
  const filtered = arr.filter((e) => {
    const t = safeParseDate(e?.start);
    if (t === null) return false;
    return t >= startMs && t <= endMs;
  });

  return NextResponse.json({
    events: filtered,
    from: startQS,
    to: endQS,
    count: filtered.length,
  });
}
