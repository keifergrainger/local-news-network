// app/api/events-local/summary/route.ts
import { NextResponse } from "next/server";

type LocalEventSummary = {
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

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const payload: LocalEventSummary = {
      date: today,
      totalEvents: 0,
      topEvent: null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Error in /api/events-local/summary:", err);
    return NextResponse.json(
      { error: "Failed to generate local events summary" },
      { status: 500 }
    );
  }
}
