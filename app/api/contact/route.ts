import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  console.log("Contact form:", body);
  return NextResponse.json({ ok: true });
}
