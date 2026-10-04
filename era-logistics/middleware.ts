import type { NextRequest } from "next/server";
import {
  createSatelliteStaffMiddleware,
  redirectNoStore,
} from "@era/satellite-kit/auth/middleware-edge";
import { isPublicStaffPage, routePermissions } from "@/lib/auth/page-route-permissions";
import { sessionHasAnyPermission } from "@/lib/auth/permission-check";

export const middleware = createSatelliteStaffMiddleware<NextRequest>({
  isPublicPage: isPublicStaffPage,
  authorizePage: ({ request, pathname, session }) => {
    const required = routePermissions(pathname);
    if (required === "auth") return null;
    if (required && sessionHasAnyPermission(session, required)) return null;
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = "/login";
    forbiddenUrl.search = "";
    forbiddenUrl.searchParams.set("error", "forbidden");
    return redirectNoStore(forbiddenUrl);
  },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
