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
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";
import { routePermission } from "@/lib/auth/clinic-permissions";
import { sessionMayPrintVisitExam } from "@/lib/auth/visit-exam-print-access";
import {
  parsePresetsCookie,
  pathnameRequiresPreset,
  hasPresetInList,
  PRESETS_COOKIE,
} from "@/domain/presets/preset-cookie";

const COOKIE = authCookieName();

function withPath(request: NextRequest) {
  return eraPathnameRequestHeaders(request.headers, request.nextUrl.pathname);
}

function roleGuardResponse(request: NextRequest, reqHeaders: Headers) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("error", "forbidden");
  return redirectNoStore(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Multipart import: verify cookie on the original request, then pass through.
  // Cloning headers via NextResponse.next({ request: { headers } }) drops Cookie
  // and truncates FormData on POST → 401 Unauthorized or parse failure.
  if (pathname.startsWith("/api/import")) {
    const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await verifySatelliteSession(token);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const reqHeaders = withPath(request);

  const clinicPublicApi = [
    "/api/portal/session",
    "/api/sanatorium/episodes/from-stay",
    "/api/integration/hotel-lifecycle",
    "/api/integration/settlement-confirmed",
    "/api/integration/staff-provision",
    "/api/booking",
    "/api/cron",
    "/api/internal/v1/extras/hotel-void",
  ];
  if (pathname.startsWith("/api")) {
    if (isPublicApiPath(pathname, clinicPublicApi)) {
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
    pathname.startsWith("/help/") ||
    pathname === "/portal" ||
    pathname.startsWith("/booking")
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
    const session = await verifySatelliteSession(token);
    if (pathname.startsWith("/print/visit-exam")) {
      if (
        !sessionMayPrintVisitExam({
          role: session.role ?? "",
          roles: session.roles,
          permissions: session.permissions,
          login: session.login ?? "",
          email: session.email,
          isOwner: session.isOwner,
        })
      ) {
        return roleGuardResponse(request, reqHeaders);
      }
      return NextResponse.next({ request: { headers: reqHeaders } });
    }
    const required = routePermission(pathname);
    if (
      required &&
      !sessionHasClinicPermission(
        {
          role: session.role,
          roles: session.roles,
          permissions: session.permissions,
          login: session.login,
          email: session.email,
          isOwner: session.isOwner,
        },
        required,
      )
    ) {
      return roleGuardResponse(request, reqHeaders);
    }
    const requiredPreset = pathnameRequiresPreset(pathname);
    if (requiredPreset) {
      const enabled = parsePresetsCookie(
        request.cookies.get(PRESETS_COOKIE)?.value,
      );
      if (!hasPresetInList(enabled, requiredPreset)) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("error", "preset_disabled");
        return redirectNoStore(url);
      }
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
