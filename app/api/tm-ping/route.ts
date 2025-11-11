export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.TICKETMASTER_KEY || "";
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(
    key
  )}&city=Salt%20Lake%20City&size=1`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();
    return new Response(
      JSON.stringify({ status: r.status, ok: r.ok, url, sample: text.slice(0, 400) }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
