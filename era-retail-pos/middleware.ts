import type { NextRequest } from "next/server";
import {
  createSatelliteStaffMiddleware,
  staffAccessDeniedRedirect,
} from "@era/satellite-kit/auth/middleware-edge";
import { isPublicStaffPage, routePermissions } from "@/lib/auth/page-route-permissions";
import { sessionHasAnyPermission } from "@/lib/auth/permission-check";

export const middleware = createSatelliteStaffMiddleware<NextRequest>({
  publicApiPrefixes: [
    "/api/integration/settlement-confirmed",
    "/api/integration/prescription-queue",
    "/api/internal/v1/shifts/open",
  ],
  isPublicPage: isPublicStaffPage,
  authorizePage: ({ request, pathname, session }) => {
    const required = routePermissions(pathname);
    if (required === "auth") return null;
    if (required && sessionHasAnyPermission(session, required)) return null;
    return staffAccessDeniedRedirect(request);
  },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
