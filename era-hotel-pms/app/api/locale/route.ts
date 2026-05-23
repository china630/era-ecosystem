import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';

const schema = z.object({
  locale: z.string(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  if (!isLocale(body.locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale: body.locale });
  res.cookies.set(LOCALE_COOKIE, body.locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  return res;
}
