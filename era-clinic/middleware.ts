import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authCookieName,
  getBearerOrCookieToken,
  isPublicApiPath,
  verifySatelliteSession,
} from "@era/satellite-kit";

const COOKIE = authCookieName();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    if (isPublicApiPath(pathname, ["/api/sanatorium/episodes/from-stay"])) return NextResponse.next();
    const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const session = await verifySatelliteSession(token);
      const headers = new Headers(request.headers);
      headers.set("x-user-id", session.sub);
      headers.set("x-user-role", session.role);
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
  }

  if (pathname === "/login") return NextResponse.next();
  const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  try {
    await verifySatelliteSession(token);
    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
