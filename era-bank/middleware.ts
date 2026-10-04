import type { NextRequest } from "next/server";
import {
  createSatelliteStaffMiddleware,
  redirectNoStore,
} from "@era/satellite-kit/auth/middleware-edge";
import {
  isPublicStaffPage,
  routePermissions,
} from "@/lib/auth/page-route-permissions";
import { sessionHasBankPermission } from "@/lib/auth/permission-check";

export const middleware = createSatelliteStaffMiddleware<NextRequest>({
  satelliteKey: "industry_banking",
  publicApiPrefixes: ["/api/health"],
  isPublicPage: isPublicStaffPage,
  loginRedirectPath: (request, reason) =>
    reason === "missing"
      ? `/login?${new URLSearchParams({ from: request.nextUrl.pathname })}`
      : "/login",
  authorizePage: ({ request, pathname, session }) => {
    const required = routePermissions(pathname);
    const sessionView = {
      login: session.login,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      isOwner: session.isOwner,
    };
    if (required && required.some((p) => sessionHasBankPermission(sessionView, p))) {
      return null;
    }
    const forbiddenUrl = new URL("/login", request.url);
    forbiddenUrl.searchParams.set("error", "forbidden");
    return redirectNoStore(forbiddenUrl);
  },
});

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
