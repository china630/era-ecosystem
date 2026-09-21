import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authCookieName,
  eraPathnameRequestHeaders,
  getBearerOrCookieToken,
  isPublicApiPath,
  nextWithOptionalHostBoundOrg,
  redirectNoStore,
  verifySatelliteSession,
} from "@era/satellite-kit/auth/middleware-edge";
import {
  isPublicStaffPage,
  routePermissions,
} from "@/lib/auth/page-route-permissions";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";

const COOKIE = authCookieName();

function withPath(request: NextRequest) {
  return eraPathnameRequestHeaders(request.headers, request.nextUrl.pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqHeaders = withPath(request);

  const fnbPublicApi = [
    "/api/integration/staff-provision",
    "/api/integration/settlement-confirmed",
    "/api/public/menu",
    "/api/auth/pin",
  ];

  function verifyPosBridge(req: NextRequest): boolean {
    const secret = process.env.POS_BRIDGE_SECRET;
    if (!secret) return false;
    const header = req.headers.get("x-pos-bridge-secret");
    const auth = req.headers.get("authorization");
    if (header === secret) return true;
    if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
    return false;
  }

  if (pathname.startsWith("/api")) {
    if (
      pathname === "/api/integration/settlement-confirmed" &&
      verifyPosBridge(request)
    ) {
      return NextResponse.next({ request: { headers: reqHeaders } });
    }
    if (isPublicApiPath(pathname, fnbPublicApi)) {
      return NextResponse.next({ request: { headers: reqHeaders } });
    }
    const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const session = await verifySatelliteSession(token);
      const headers = new Headers(reqHeaders);
      headers.set("x-user-id", session.sub);
      headers.set("x-user-role", session.role);
      if (session.organizationId) {
        headers.set("x-era-organization-id", session.organizationId);
      }
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
  }

  if (isPublicStaffPage(pathname)) {
    if (pathname === "/login" || pathname === "/pin") {
      return nextWithOptionalHostBoundOrg(
        reqHeaders,
        request.headers.get("x-forwarded-host") || request.headers.get("host"),
        "industry_fnb_pos",
      );
    }
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectNoStore(url);
  }
  try {
    const session = await verifySatelliteSession(token);
    const required = routePermissions(pathname);
    const sessionView = {
      login: session.login,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      isOwner: session.isOwner,
      pin: session.pin,
    };
    if (
      !required ||
      !required.some((p) => sessionHasFnbPermission(sessionView, p))
    ) {
      const forbiddenUrl = request.nextUrl.clone();
      forbiddenUrl.pathname = "/login";
      forbiddenUrl.searchParams.set("error", "forbidden");
      return redirectNoStore(forbiddenUrl);
    }
    return NextResponse.next({ request: { headers: reqHeaders } });
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectNoStore(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
