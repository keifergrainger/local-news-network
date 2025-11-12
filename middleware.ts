import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  if (url.pathname === "/api/events" || url.pathname === "/api/events/summary") {
    url.pathname = "/api/events-local";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/events", "/api/events/summary"],
};
