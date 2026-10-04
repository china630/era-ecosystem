import type { NextRequest } from "next/server";
import {
  createSatelliteStaffMiddleware,
  redirectNoStore,
} from "@era/satellite-kit/auth/middleware-edge";
import {
  isPublicStaffPage,
  routePermissions,
} from "@/lib/auth/page-route-permissions";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { LOGIN_CHOICE_COOKIE, LOGIN_CHOICE_PASSWORD } from "@/lib/auth/login-choice";

const TERMINAL_COOKIE = "era_fnb_terminal";

function openPinPad(request: NextRequest): boolean {
  if (!request.cookies.get(TERMINAL_COOKIE)?.value) return false;
  return request.cookies.get(LOGIN_CHOICE_COOKIE)?.value !== LOGIN_CHOICE_PASSWORD;
}

const staffGate = createSatelliteStaffMiddleware<NextRequest>({
  satelliteKey: "industry_fnb_pos",
  publicApiPrefixes: [
    "/api/integration/staff-provision",
    // Route checks POS_BRIDGE_SECRET itself.
    "/api/integration/settlement-confirmed",
    "/api/public/menu",
    "/api/auth/pin",
    "/api/auth/terminal",
  ],
  isPublicPage: isPublicStaffPage,
  loginPaths: ["/login", "/pin"],
  loginRedirectPath: (request) => (openPinPad(request) ? "/pin" : "/login"),
  authorizePage: ({ request, pathname, session }) => {
    const required = routePermissions(pathname);
    const sessionView = {
      login: session.login,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      isOwner: session.isOwner,
      pin: session.pin,
    };
    if (required && required.some((p) => sessionHasFnbPermission(sessionView, p))) {
      return null;
    }
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = session.pin ? "/floor" : "/login";
    if (!session.pin) forbiddenUrl.searchParams.set("error", "forbidden");
    return redirectNoStore(forbiddenUrl);
  },
});

export async function middleware(request: NextRequest): Promise<Response> {
  const res = await staffGate(request);
  // An explicit PIN visit undoes the password choice for the next redirect.
  if (request.nextUrl.pathname === "/pin" && request.cookies.get(LOGIN_CHOICE_COOKIE)) {
    res.headers.append(
      "Set-Cookie",
      `${LOGIN_CHOICE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
