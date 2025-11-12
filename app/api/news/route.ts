import { NextRequest, NextResponse } from "next/server";
import { getCityFromHost } from "@/lib/cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseRss(xml: string) {
  const items: Array<{ title: string; link: string; source?: string; publishedAt: string }> = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const t = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
    const l = b.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1] || "";
    const d = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "";
    const s = b.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/i)?.[1] || "";
    if (t && l && d) items.push({ title: decodeHtml(t.trim()), link: l.trim(), source: s.trim(), publishedAt: new Date(d).toISOString() });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const city = getCityFromHost(host);

  const url = new URL(req.url);
  const qOverride = url.searchParams.get("q");
  const q = qOverride || `${city.city} ${city.state} when:1d`;

  const feed = new URL("https://news.google.com/rss/search");
  feed.searchParams.set("q", q);
  feed.searchParams.set("hl", "en-US");
  feed.searchParams.set("gl", "US");
  feed.searchParams.set("ceid", "US:en");

  try {
    const r = await fetch(feed.toString(), { next: { revalidate: 180 } }); // 3 min
    if (!r.ok) throw new Error(`news ${r.status}`);
    const xml = await r.text();
    const all = parseRss(xml);

    // prefer <= 24h, fallback to <= 48h if empty
    const now = Date.now();
    const within = (ms: number) => all
      .filter(i => { const t = Date.parse(i.publishedAt); return Number.isFinite(t) && (now - t) <= ms; })
      .sort((a,b) => Date.parse(b.publishedAt)-Date.parse(a.publishedAt));

    let items = within(24*60*60*1000);
    if (items.length === 0) items = within(48*60*60*1000);

    const seen = new Set<string>();
    items = items.filter(i => (seen.has(i.title) ? false : (seen.add(i.title), true))).slice(0, 60);

    return NextResponse.json({ city: { city: city.city, state: city.state }, items });
  } catch (e) {
    return NextResponse.json({ city: { city: city.city, state: city.state }, items: [], error: String(e) }, { status: 200 });
  }
}
