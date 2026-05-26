import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import {
  isPosBridgeApiPath,
  verifyPosBridgeFromHeaders,
} from '@/lib/pos-bridge-auth';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? 'era_session';

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/sso/exchange',
  '/api/locale',
  '/api/integration/mock-receiver',
  '/api/integration/mock-licensing',
  '/api/integration/erp/inbound',
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

function getToken(request: NextRequest): string | undefined {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie) return cookie;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api')) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }

    if (
      isPosBridgeApiPath(pathname) &&
      verifyPosBridgeFromHeaders(
        request.headers.get('x-pos-bridge-secret'),
        request.headers.get('authorization'),
      )
    ) {
      return NextResponse.next();
    }

    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const session = await verifyToken(token);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', session.sub);
      requestHeaders.set('x-user-role', session.role);
      requestHeaders.set('x-user-login', session.login);
      requestHeaders.set('x-user-fullname', session.fullName);
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
  }

  if (
    pathname === '/login' ||
    pathname === '/sso/callback' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = getToken(request);
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
