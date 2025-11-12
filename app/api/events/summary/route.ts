// app/api/events/summary/route.ts
import { NextResponse } from "next/server";

type EventSummary = {
  date: string;
  totalEvents: number;
  topEvent?: {
    id: string;
    name: string;
    startTime: string;
    venue: string;
    url?: string;
  } | null;
};

// Optional: tell Next this is always dynamic (no static pre-rendering)
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const payload: EventSummary = {
      date: today,
      totalEvents: 0,
      topEvent: null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Error in /api/events/summary:", err);
    return NextResponse.json(
      { error: "Failed to generate events summary" },
      { status: 500 }
    );
  }
}
