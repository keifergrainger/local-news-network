import { NextResponse } from "next/server";
import { loadFilteredEvents } from "./helpers";

export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    const { city, center, range, events } = await loadFilteredEvents(url);

    return NextResponse.json({
      city: { city: city.city, state: city.state },
      center,
      from: range.from ? range.from.toISOString() : null,
      to: range.to ? range.to.toISOString() : null,
      count: events.length,
      events,
    });
  } catch {
    return NextResponse.json({
      city: null,
      center: null,
      from: null,
      to: null,
      count: 0,
      events: [],
    });
  }
}
