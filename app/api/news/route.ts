import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

// Minimal RSS parser for <item><title> / <link> / <pubDate>
function parseItems(xml: string) {
  const items: { title: string; link: string; pubDate?: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml))) {
    const block = match[1];
    const t = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(block);
    const l = /<link>(.*?)<\/link>/.exec(block);
    const d = /<pubDate>(.*?)<\/pubDate>/.exec(block);
    const title = (t?.[1] || t?.[2] || "").trim();
    const link = (l?.[1] || "").trim();
    if (title) items.push({ title, link, pubDate: d?.[1] });
  }
  return items;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const host = (url.searchParams.get("host") || "").toLowerCase();
    const city =
      CITIES.find((c) => host.includes(c.host)) ||
      CITIES[0];

    const queries =
      city.rssQueries && city.rssQueries.length
        ? city.rssQueries
        : [`${city.city} ${city.state} news`];

    // Build Google News RSS feed URLs
    const feeds = queries.map(
      (q) =>
        `https://news.google.com/rss/search?q=${encodeURIComponent(
          q
        )}&hl=en-US&gl=US&ceid=US:en`
    );

    // Fetch all feeds in parallel
    const xmls = await Promise.all(
      feeds.map((f) => fetch(f, { cache: "no-store" }).then((r) => r.text()))
    );

    // Parse, merge, and dedupe by title
    const all = xmls.flatMap(parseItems);
    const seen = new Set<string>();
    const deduped = all.filter((i) => {
      const key = i.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by pubDate desc (if present) and take top 8
    const top = deduped
      .sort((a, b) => {
        const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
        const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
        return tb - ta;
      })
      .slice(0, 8);

    return NextResponse.json({
      city: { host: city.host, name: `${city.city}, ${city.state}` },
      headlines: top, // [{title, link, pubDate}]
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { headlines: [], error: "failed_to_fetch" },
      { status: 200 }
    );
  }
}
