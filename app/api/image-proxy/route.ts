import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return NextResponse.json({ error: 'missing url' }, { status: 400 });
  }
  try {
    const r = await fetch(target, { next: { revalidate: 3600 } });
    if (!r.ok) {
      return NextResponse.json({ error: 'bad upstream' }, { status: 400 });
    }
    const headers = new Headers(r.headers);
    headers.set('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
    headers.delete('content-security-policy');
    const body = r.body;
    return new NextResponse(body, { headers });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 400 });
  }
}
