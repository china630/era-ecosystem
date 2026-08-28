import { NextResponse } from 'next/server';
import {
  agencyAuthCookieName,
  authCookieName,
  eraPathnameRequestHeaders,
  getBearerOrCookieToken,
  isPublicApiPath,
  redirectNoStore,
  verifyAgencySession,
  verifySatelliteSession,
} from '@era/satellite-kit/auth/middleware-edge';
import type { NextRequest } from 'next/server';
import {
  isPosBridgeApiPath,
  verifyPosBridgeFromHeaders,
} from '@/lib/pos-bridge-auth-edge';

const STAFF_COOKIE = authCookieName();
const AGENCY_COOKIE = agencyAuthCookieName();

const PUBLIC_API_EXTRA = [
  '/api/integration/mock-receiver',
  '/api/integration/mock-licensing',
  '/api/integration/erp/inbound',
  '/api/integration/staff-provision',
  '/api/auth/agency-sso/exchange',
  '/api/integrations/elektraweb-bridge',
];

function isAgencyPath(pathname: string): boolean {
  return (
    pathname === '/agency' ||
    pathname.startsWith('/agency/') ||
    pathname === '/api/agency' ||
    pathname.startsWith('/api/agency/')
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqHeaders = eraPathnameRequestHeaders(request.headers, pathname);

  // Placement FREEZE: block mutating ops for listed orgs (host sets ERA_PLACEMENT_FROZEN_ORG_IDS).
  const method = request.method.toUpperCase();
  if (
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS" &&
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/internal/") &&
    !pathname.startsWith("/api/auth/")
  ) {
    const frozen =
      process.env.ERA_PLACEMENT_FROZEN_ORG_IDS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    if (frozen.length) {
      const org =
        request.headers.get("x-era-organization-id")?.trim() ||
        "";
      if (org && frozen.includes(org)) {
        return NextResponse.json(
          { error: "Organization frozen for placement hop" },
          { status: 423 },
        );
      }
    }
  }

  // Agency SSO callback is public HTML
  if (pathname === '/agency/sso/callback' || pathname.startsWith('/agency/sso/callback/')) {
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

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

    // Agency API: only agency session
    if (pathname.startsWith('/api/agency')) {
      const agencyToken = getBearerOrCookieToken(
        request.cookies,
        request.headers,
        AGENCY_COOKIE,
      );
      if (!agencyToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        const session = await verifyAgencySession(agencyToken);
        const headers = new Headers(reqHeaders);
        headers.set('x-agency-id', session.agencyId);
        headers.set('x-agency-email', session.email);
        headers.set('x-user-actor', 'agency');
        return NextResponse.next({ request: { headers } });
      } catch {
        return NextResponse.json({ error: 'Invalid agency session' }, { status: 401 });
      }
    }

    // Staff API: reject pure agency sessions
    const staffToken = getBearerOrCookieToken(
      request.cookies,
      request.headers,
      STAFF_COOKIE,
    );
    if (!staffToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      const session = await verifySatelliteSession(staffToken);
      const headers = new Headers(reqHeaders);
      headers.set('x-user-id', session.sub);
      headers.set('x-user-role', session.role);
      headers.set('x-user-login', session.login);
      headers.set('x-user-fullname', session.fullName);
      if (session.email) headers.set('x-user-email', session.email);
      if (session.organizationId) {
        headers.set('x-era-organization-id', session.organizationId);
      }
      headers.set('x-user-actor', 'staff');
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

  // Agency UI pages
  if (isAgencyPath(pathname)) {
    const agencyToken = getBearerOrCookieToken(
      request.cookies,
      request.headers,
      AGENCY_COOKIE,
    );
    if (!agencyToken) {
      return redirectNoStore(new URL('/agency/sso/callback?error=login', request.url));
    }
    try {
      await verifyAgencySession(agencyToken);
      return NextResponse.next({ request: { headers: reqHeaders } });
    } catch {
      return redirectNoStore(new URL('/agency/sso/callback?error=session', request.url));
    }
  }

  // Staff UI — agency cookie alone is not enough
  const token = getBearerOrCookieToken(request.cookies, request.headers, STAFF_COOKIE);
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
