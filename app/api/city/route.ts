import { NextRequest, NextResponse } from "next/server";
import { getCityFromHost } from "@/lib/cities";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const city = getCityFromHost(host);
  return NextResponse.json({ host, city });
}
