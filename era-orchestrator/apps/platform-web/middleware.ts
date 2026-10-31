import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eraPathnameRequestHeaders } from "@era/satellite-kit/auth/middleware-edge";

export function middleware(request: NextRequest) {
  const reqHeaders = eraPathnameRequestHeaders(
    request.headers,
    request.nextUrl.pathname,
  );
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
