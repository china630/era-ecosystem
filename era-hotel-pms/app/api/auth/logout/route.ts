import { jsonOk } from '@/lib/api-utils';

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'era_session';

export async function POST() {
  const res = jsonOk({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
