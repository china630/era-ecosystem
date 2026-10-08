import { NextResponse } from 'next/server';
import {
  agencyAuthCookieName,
  createSatelliteStaffMiddleware,
  eraPathnameRequestHeaders,
  getBearerOrCookieToken,
  redirectNoStore,
  redirectReferralToOrchestratorRegister,
  stripSessionHeaders,
  verifyAgencySession,
} from '@era/satellite-kit/auth/middleware-edge';
import type { NextRequest } from 'next/server';
import {
  isPosBridgeApiPath,
  verifyPosBridgeFromHeaders,
} from '@/lib/pos-bridge-auth-edge';
import { routePermissions } from '@/lib/auth/page-route-permissions';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';

const AGENCY_COOKIE = agencyAuthCookieName();

function isAgencyPath(pathname: string): boolean {
  return (
    pathname === '/agency' ||
    pathname.startsWith('/agency/') ||
    pathname === '/api/agency' ||
    pathname.startsWith('/api/agency/')
  );
}

function isPublicStaffPage(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/sso/callback' ||
    pathname === '/help' ||
    pathname.startsWith('/help/') ||
    pathname === '/b2c' ||
    pathname.startsWith('/b2c/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  );
}

const staffGate = createSatelliteStaffMiddleware<NextRequest>({
  satelliteKey: 'industry_hotel_pms',
  publicApiPrefixes: [
    '/api/integration/mock-receiver',
    '/api/integration/mock-licensing',
    '/api/integration/erp/inbound',
    '/api/integrations/elektraweb-bridge',
    '/api/integrations/channex',
    '/api/integrations/ota',
    '/api/public',
  ],
  isPublicPage: isPublicStaffPage,
  loginRedirectPath: (request, reason) =>
    reason === 'missing'
      ? `/login?from=${encodeURIComponent(request.nextUrl.pathname)}`
      : '/login',
  // Fail-closed: every staff page must map to a permission (see page inventory test).
  authorizePage: ({ request, pathname, session }) => {
    const required = routePermissions(pathname);
    const sessionView = {
      login: session.login,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      isOwner: session.isOwner,
    };
    if (required && required.some((p) => sessionHasHotelPermission(sessionView, p))) {
      return null;
    }
    const forbiddenUrl = new URL('/login', request.url);
    forbiddenUrl.searchParams.set('error', 'forbidden');
    return redirectNoStore(forbiddenUrl);
  },
  authorizeApi: ({ request, pathname, session }) =>
    frozenOrgResponse(request.method, pathname, session.organizationId),
});

/** Placement hop: writes for a frozen org get 423. The org comes from the verified token. */
function frozenOrgResponse(
  method: string,
  pathname: string,
  organizationId: string | undefined,
): Response | null {
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return null;
  if (pathname.startsWith('/api/auth/')) return null;
  const frozen =
    process.env.ERA_PLACEMENT_FROZEN_ORG_IDS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (!frozen.length) return null;
  const org = organizationId?.trim() || '';
  if (org && frozen.includes(org)) {
    return NextResponse.json(
      { error: 'Organization frozen for placement hop' },
      { status: 423 },
    );
  }
  return null;
}

async function agencyResponse(request: NextRequest, pathname: string): Promise<Response> {
  const reqHeaders = stripSessionHeaders(
    eraPathnameRequestHeaders(request.headers, pathname, request.method),
  );
  const agencyToken = getBearerOrCookieToken(request.cookies, request.headers, AGENCY_COOKIE);
  const isApi = pathname.startsWith('/api/');
  if (!agencyToken) {
    return isApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : redirectNoStore(new URL('/agency/sso/callback?error=login', request.url));
  }
  try {
    const session = await verifyAgencySession(agencyToken);
    if (!isApi) return NextResponse.next({ request: { headers: reqHeaders } });
    const headers = new Headers(reqHeaders);
    headers.set('x-agency-id', session.agencyId);
    headers.set('x-agency-email', session.email);
    headers.set('x-user-actor', 'agency');
    return NextResponse.next({ request: { headers } });
  } catch {
    return isApi
      ? NextResponse.json({ error: 'Invalid agency session' }, { status: 401 })
      : redirectNoStore(new URL('/agency/sso/callback?error=session', request.url));
  }
}

export async function middleware(request: NextRequest): Promise<Response> {
  const referralRedirect = redirectReferralToOrchestratorRegister(request);
  if (referralRedirect) return referralRedirect;
  const { pathname } = request.nextUrl;

  if (pathname === '/agency/sso/callback' || pathname.startsWith('/agency/sso/callback/')) {
    return NextResponse.next({
      request: {
        headers: stripSessionHeaders(
          eraPathnameRequestHeaders(request.headers, pathname, request.method),
        ),
      },
    });
  }

  if (
    isPosBridgeApiPath(pathname) &&
    verifyPosBridgeFromHeaders(
      request.headers.get('x-pos-bridge-secret'),
      request.headers.get('authorization'),
    )
  ) {
    return NextResponse.next({
      request: { headers: eraPathnameRequestHeaders(request.headers, pathname, request.method) },
    });
  }

  // Agency cookie alone never opens staff API or pages, and vice versa.
  if (isAgencyPath(pathname)) return agencyResponse(request, pathname);

  return staffGate(request);
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
