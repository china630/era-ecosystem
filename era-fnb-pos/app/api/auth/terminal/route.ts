import {
  authCookieName,
  authenticateIndustryStaffLogin,
  enterSatelliteTenant,
  isSatelliteUserLoginAllowed,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  ensureSystemFnbRoles,
  resolveFnbEdition,
} from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import {
  readTerminalCookie,
  signTerminalCookie,
  TERMINAL_COOKIE,
  TERMINAL_MAX_MS,
  terminalCookieHeader,
} from "@/lib/terminal-cookie";

async function liveTerminal(request: Request) {
  const claims = readTerminalCookie(terminalCookieHeader(request));
  if (!claims) return null;
  enterSatelliteTenant({ organizationId: claims.organizationId });
  const outlet = await prisma.outlet.findFirst({
    where: { id: claims.outletId, organizationId: claims.organizationId, active: true },
  });
  if (!outlet) return null;
  if (outlet.terminalRevokedAt && outlet.terminalRevokedAt.getTime() >= claims.boundAt) {
    return null;
  }
  return { claims, outlet };
}

export async function GET(request: Request) {
  try {
    const live = await liveTerminal(request);
    if (!live) return jsonOk({ bound: false });
    const staff = await prisma.staffRoster.findMany({
      where: {
        organizationId: live.claims.organizationId,
        outletId: live.outlet.id,
        active: true,
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    return jsonOk({
      bound: true,
      outletCode: live.outlet.code,
      outletName: live.outlet.name,
      staff,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateIndustryStaffLogin({
      request,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) return jsonError(auth.error, auth.status);
    const user = auth.user;
    const organizationId = auth.organizationId;
    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureSystemFnbRoles(prisma, organizationId, edition);
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    if (!refreshed || !isSatelliteUserLoginAllowed(refreshed)) {
      return jsonError("Invalid credentials", 401);
    }
    const bypass = hasFnbPermissionBypass({
      login: refreshed.login,
      email: refreshed.email ?? undefined,
      role: refreshed.role.code,
      isOwner: false,
    });
    const manager = refreshed.role.code === ROLE_CODES.MANAGER;
    if (!bypass && !manager) {
      return jsonError("TERMINAL_BIND_DENIED", 403);
    }
    const outlet = await resolveOpsOutlet(
      profile.enabledPresets.includes("cafe") ? "KAFE" : null,
    );
    const boundAt = Date.now();
    const token = signTerminalCookie({
      organizationId,
      outletId: outlet.id,
      boundAt,
    });
    const staff = await prisma.staffRoster.findMany({
      where: { organizationId, outletId: outlet.id, active: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    const res = jsonOk({
      bound: true,
      outletCode: outlet.code,
      outletName: outlet.name,
      staff,
    });
    res.cookies.set(authCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set(TERMINAL_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(TERMINAL_MAX_MS / 1000),
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
