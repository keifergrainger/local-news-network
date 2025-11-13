import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const submission = {
      name: (body?.name || '').toString().trim(),
      dateTime: (body?.dateTime || '').toString().trim(),
      location: (body?.location || '').toString().trim(),
      link: body?.link ? body.link.toString().trim() : '',
      email: body?.email ? body.email.toString().trim() : '',
      receivedAt: new Date().toISOString(),
    };

    if (!submission.name || !submission.dateTime || !submission.location) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    console.info('[event-submission] queued for review', submission);

    return NextResponse.json({ ok: true, review: 'pending' });
  } catch (err) {
    console.error('[event-submission] failed', err);
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }
}
