import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authCookieName,
  eraPathnameRequestHeaders,
  getBearerOrCookieToken,
  isPublicApiPath,
  redirectNoStore,
  verifySatelliteSession,
} from "@era/satellite-kit/auth/middleware-edge";

const COOKIE = authCookieName();

function withPath(request: NextRequest) {
  return eraPathnameRequestHeaders(request.headers, request.nextUrl.pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqHeaders = withPath(request);

  const fnbPublicApi = ["/api/integration/staff-provision", "/api/integration/settlement-confirmed"];

  function verifyPosBridge(request: NextRequest): boolean {
    const secret = process.env.POS_BRIDGE_SECRET;
    if (!secret) return false;
    const header = request.headers.get("x-pos-bridge-secret");
    const auth = request.headers.get("authorization");
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

  if (
    pathname === "/login" ||
    pathname === "/sso/callback" ||
    pathname === "/help" ||
    pathname.startsWith("/help/")
  ) {
    return NextResponse.next({ request: { headers: reqHeaders } });
  }
  const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectNoStore(url);
  }
  try {
    await verifySatelliteSession(token);
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
