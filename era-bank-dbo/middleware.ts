import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DBO_SESSION_COOKIE,
  verifyDboSessionCookie,
} from "@/lib/dbo-session-cookie";
import { nextWithOptionalHostBoundOrg } from "@era/satellite-kit/auth/middleware-edge";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(DBO_SESSION_COOKIE)?.value;
  const session = token ? await verifyDboSessionCookie(token) : null;

  if (pathname.startsWith("/api")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (session) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    if (pathname === "/login") {
      const reqHeaders = new Headers(request.headers);
      return nextWithOptionalHostBoundOrg(
        reqHeaders,
        request.headers.get("x-forwarded-host") || request.headers.get("host"),
        process.env.ERA_SATELLITE_KEY?.trim() || "banking_dbo",
      );
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
