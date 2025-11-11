import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { CITIES } from "@/lib/cities";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const host = (url.searchParams.get("host") || "").toLowerCase();
    const city = CITIES.find(c => host.includes(c.host)) || CITIES[0];

    const parser = new Parser({
      headers: { "User-Agent": "LocalNewsNetworkBot/1.0" }
    });

    const allItems = [];

    for (const q of city.rssQueries || []) {
      const rssURL = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const feed = await parser.parseURL(rssURL);
      allItems.push(...feed.items.map(i => ({
        title: i.title,
        link: i.link,
        pubDate: i.pubDate
      })));
    }

    // Remove duplicates by title
    const seen = new Set();
    const unique = allItems.filter(i => {
      if (seen.has(i.title)) return false;
      seen.add(i.title);
      return true;
    });

    return NextResponse.json({
      city: { host: city.host, name: `${city.city}, ${city.state}` },
      headlines: unique.slice(0, 30)
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ headlines: [] }, { status: 200 });
  }
}
