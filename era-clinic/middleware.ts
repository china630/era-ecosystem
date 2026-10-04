import type { NextRequest } from "next/server";
import {
  createSatelliteStaffMiddleware,
  redirectNoStore,
} from "@era/satellite-kit/auth/middleware-edge";
import { CLINIC_SATELLITE_KEY } from "@/lib/clinic-satellite-key";
import { sessionHasAnyClinicPermission } from "@/lib/auth/clinic-permission-check";
import {
  isAuthOnlyStaffPage,
  isPublicStaffPage,
  routePermissions,
} from "@/lib/auth/clinic-permissions";
import { sessionMayPrintVisitExam } from "@/lib/auth/visit-exam-print-access";
import {
  parsePresetsCookie,
  pathnameRequiresPreset,
  hasPresetInList,
  PRESETS_COOKIE,
} from "@/domain/presets/preset-cookie";

function roleGuardResponse(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("error", "forbidden");
  return redirectNoStore(url);
}

export const middleware = createSatelliteStaffMiddleware<NextRequest>({
  satelliteKey: CLINIC_SATELLITE_KEY,
  publicApiPrefixes: [
    "/api/portal/session",
    "/api/sanatorium/episodes/from-stay",
    "/api/integration/hotel-lifecycle",
    "/api/integration/settlement-confirmed",
    "/api/integration/staff-provision",
    "/api/booking",
    "/api/cron",
    "/api/internal/v1/extras/hotel-void",
    "/api/capacity/summary",
  ],
  // Route checks CLINIC_BRIDGE_SECRET, then reads the caller's org header.
  serviceApiPrefixes: ["/api/capacity/summary"],
  passthroughApiPrefixes: ["/api/import"],
  isPublicPage: isPublicStaffPage,
  authorizePage: ({ request, pathname, session }) => {
    if (pathname.startsWith("/print/visit-exam")) {
      const allowed = sessionMayPrintVisitExam({
        role: session.role ?? "",
        roles: session.roles,
        permissions: session.permissions,
        login: session.login ?? "",
        email: session.email,
        isOwner: session.isOwner,
      });
      return allowed ? null : roleGuardResponse(request);
    }
    // Auth-only: any logged-in staff (own password change).
    if (isAuthOnlyStaffPage(pathname)) return null;
    const required = routePermissions(pathname);
    const sessionView = {
      role: session.role,
      roles: session.roles,
      permissions: session.permissions,
      login: session.login,
      email: session.email,
      isOwner: session.isOwner,
    };
    // Fail-closed: every staff page must map to a permission (see page inventory test).
    if (!required?.length || !sessionHasAnyClinicPermission(sessionView, required)) {
      return roleGuardResponse(request);
    }
    const requiredPreset = pathnameRequiresPreset(pathname);
    if (requiredPreset) {
      const enabled = parsePresetsCookie(request.cookies.get(PRESETS_COOKIE)?.value);
      if (!hasPresetInList(enabled, requiredPreset)) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("error", "preset_disabled");
        return redirectNoStore(url);
      }
    }
    return null;
  },
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
