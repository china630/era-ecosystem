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
import { hasClinicAdminAccess } from "@/lib/auth/clinic-admin-access";
import { sessionHasClinicRole, CLINIC_ROLE } from "@/lib/clinic-roles";
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
  const reqHeaders = withPath(request);

  const clinicPublicApi = [
    "/api/portal/session",
    "/api/sanatorium/episodes/from-stay",
    "/api/integration/hotel-lifecycle",
    "/api/integration/settlement-confirmed",
    "/api/booking",
    "/api/cron",
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
    if (pathname === "/doctor" || pathname.startsWith("/doctor/")) {
      // DOCTOR workspace; SatAdmin / BUSINESS_OWNER may open for oversight (same as /admin gate).
      const doctorOk =
        sessionHasClinicRole(session.role, [CLINIC_ROLE.DOCTOR, CLINIC_ROLE.CLINIC_ADMIN]) ||
        hasClinicAdminAccess(session);
      if (!doctorOk) {
        return roleGuardResponse(request, reqHeaders);
      }
    }
    if (pathname === "/nurse" || pathname.startsWith("/nurse/")) {
      const nurseOk =
        sessionHasClinicRole(session.role, [CLINIC_ROLE.NURSE, CLINIC_ROLE.CLINIC_ADMIN]) ||
        hasClinicAdminAccess(session);
      if (!nurseOk) {
        return roleGuardResponse(request, reqHeaders);
      }
    }
    if (pathname.startsWith("/sanatorium/nurse-roster")) {
      const rosterOk =
        sessionHasClinicRole(session.role, [CLINIC_ROLE.DOCTOR, CLINIC_ROLE.CLINIC_ADMIN]) ||
        hasClinicAdminAccess(session);
      if (!rosterOk) {
        return roleGuardResponse(request, reqHeaders);
      }
    }
    if (pathname.startsWith("/admin")) {
      if (!hasClinicAdminAccess(session)) {
        return roleGuardResponse(request, reqHeaders);
      }
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
