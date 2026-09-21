import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authCookieName,
  eraPathnameRequestHeaders,
  getBearerOrCookieToken,
  isPublicApiPath,
  nextWithOptionalHostBoundOrg,
  redirectNoStore,
  encodeSessionHeaderUtf8,
  verifySatelliteSession,
} from "@era/satellite-kit/auth/middleware-edge";
import {
  isPublicStaffPage,
  routePermissions,
} from "@/lib/auth/page-route-permissions";
import { sessionHasBankPermission } from "@/lib/auth/permission-check";

const COOKIE = authCookieName();

const PUBLIC_API_EXTRA = ["/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqHeaders = eraPathnameRequestHeaders(request.headers, pathname);

  if (pathname.startsWith("/api")) {
    if (isPublicApiPath(pathname, PUBLIC_API_EXTRA)) {
      return NextResponse.next({ request: { headers: reqHeaders } });
    }

    const token = getBearerOrCookieToken(
      request.cookies,
      request.headers,
      COOKIE,
    );
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const session = await verifySatelliteSession(token);
      const headers = new Headers(reqHeaders);
      headers.set("x-user-id", session.sub);
      headers.set("x-user-role", session.role);
      headers.set("x-user-login", encodeSessionHeaderUtf8(session.login));
      headers.set("x-user-fullname", encodeSessionHeaderUtf8(session.fullName));
      if (session.organizationId) {
        headers.set("x-era-organization-id", session.organizationId);
      }
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
  }

  if (isPublicStaffPage(pathname)) {
    if (pathname === "/login") {
      return nextWithOptionalHostBoundOrg(
        reqHeaders,
        request.headers.get("x-forwarded-host") || request.headers.get("host"),
        "industry_banking",
      );
    }
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  const token = getBearerOrCookieToken(
    request.cookies,
    request.headers,
    COOKIE,
  );
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return redirectNoStore(loginUrl);
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
    };
    if (
      !required ||
      !required.some((p) => sessionHasBankPermission(sessionView, p))
    ) {
      const forbiddenUrl = new URL("/login", request.url);
      forbiddenUrl.searchParams.set("error", "forbidden");
      return redirectNoStore(forbiddenUrl);
    }
    const headers = new Headers(reqHeaders);
    if (session.organizationId) {
      headers.set("x-era-organization-id", session.organizationId);
    }
    return NextResponse.next({ request: { headers } });
  } catch {
    const loginUrl = new URL("/login", request.url);
    return redirectNoStore(loginUrl);
  }
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
