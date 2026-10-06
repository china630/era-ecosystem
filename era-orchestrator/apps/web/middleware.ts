import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  eraPathnameRequestHeaders,
  redirectReferralToOrchestratorRegister,
} from "@era/satellite-kit/auth/middleware-edge";

export function middleware(request: NextRequest) {
  const referralRedirect = redirectReferralToOrchestratorRegister(request);
  if (referralRedirect) return referralRedirect;
  const reqHeaders = eraPathnameRequestHeaders(
    request.headers,
    request.nextUrl.pathname,
  );
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
