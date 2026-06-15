import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DBO_SESSION_COOKIE, verifyDboSessionCookie } from "@/lib/dbo-session-cookie";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
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

  if (pathname.startsWith("/api")) {
    if (!token || !verifyDboSessionCookie(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (token && verifyDboSessionCookie(token)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!token || !verifyDboSessionCookie(token)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
