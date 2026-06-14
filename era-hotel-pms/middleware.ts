import { NextResponse } from 'next/server';
import {
  authCookieName,
  eraPathnameRequestHeaders,
  getBearerOrCookieToken,
  isPublicApiPath,
  redirectNoStore,
  verifySatelliteSession,
} from '@era/satellite-kit/auth/middleware-edge';
import type { NextRequest } from 'next/server';
import {
  isPosBridgeApiPath,
  verifyPosBridgeFromHeaders,
} from '@/lib/pos-bridge-auth-edge';

const COOKIE = authCookieName();

const PUBLIC_API_EXTRA = [
  '/api/integration/mock-receiver',
  '/api/integration/mock-licensing',
  '/api/integration/erp/inbound',
  '/api/integration/staff-provision',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqHeaders = eraPathnameRequestHeaders(request.headers, pathname);

  if (pathname.startsWith('/api')) {
    if (isPublicApiPath(pathname, PUBLIC_API_EXTRA)) {
      return NextResponse.next({ request: { headers: reqHeaders } });
    }

    if (
      isPosBridgeApiPath(pathname) &&
      verifyPosBridgeFromHeaders(
        request.headers.get('x-pos-bridge-secret'),
        request.headers.get('authorization'),
      )
    ) {
      return NextResponse.next({ request: { headers: reqHeaders } });
    }

    const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const session = await verifySatelliteSession(token);
      const headers = new Headers(reqHeaders);
      headers.set('x-user-id', session.sub);
      headers.set('x-user-role', session.role);
      headers.set('x-user-login', session.login);
      headers.set('x-user-fullname', session.fullName);
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
  }

  if (
    pathname === '/login' ||
    pathname === '/sso/callback' ||
    pathname === '/help' ||
    pathname.startsWith('/help/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return redirectNoStore(loginUrl);
  }

  try {
    await verifySatelliteSession(token);
    return NextResponse.next({ request: { headers: reqHeaders } });
  } catch {
    const loginUrl = new URL('/login', request.url);
    return redirectNoStore(loginUrl);
  }
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
