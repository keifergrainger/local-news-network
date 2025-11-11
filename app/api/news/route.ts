import { NextResponse } from "next/server";
import { CITIES } from "@/lib/cities";

// Tiny Google News RSS reader (no external packages)
function parseItems(xml: string) {
  const items: { title: string; link: string; pubDate?: string }[] = [];
  const blocks = xml.split("<item>").slice(1);
  for (const b of blocks) {
    // title may be CDATA or plain
    const tCdata = /<title><!\[CDATA\[(.*?)\]\]><\/title>/i.exec(b)?.[1];
    const tPlain = /<title>(.*?)<\/title>/i.exec(b)?.[1];
    const title = (tCdata ?? tPlain)?.replace(/&apos;/g, "'")?.trim();
    const link = /<link>(.*?)<\/link>/i.exec(b)?.[1]?.trim();
    const pubDate = /<pubDate>(.*?)<\/pubDate>/i.exec(b)?.[1];
    if (title && link) items.push({ title, link, pubDate });
  }
  return items.slice(0, 25);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const host = (url.searchParams.get("host") || "").toLowerCase();

    const city =
      CITIES.find((c) => host.includes(c.host)) ||
      CITIES[0];

    // Use your city-specific queries if present; otherwise fallback
    const queries = city.rssQueries?.length
      ? city.rssQueries
      : [`"${city.city}" ${city.state} news`, `"${city.city}" local news`];

    // Pull multiple Google News RSS feeds and merge
    const feeds = await Promise.all(
      queries.map(async (q) => {
        const feedURL = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
        try {
          const xml = await fetch(feedURL, { cache: "no-store" }).then((r) => r.text());
          return parseItems(xml);
        } catch {
          return [];
        }
      })
    );

    // De-duplicate by title
    const seen = new Set<string>();
    const headlines = feeds
      .flat()
      .filter((h) => {
        const k = h.title.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 30);

    return NextResponse.json({
      city: { host: city.host, name: `${city.city}, ${city.state}` },
      headlines,
    });
  } catch {
    return NextResponse.json({ headlines: [] }, { status: 200 });
  }
}
