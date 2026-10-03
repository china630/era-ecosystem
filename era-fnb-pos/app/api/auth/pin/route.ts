import {
  authCookieName,
  enterSatelliteTenant,
  signSatelliteSession,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { pinMatches } from "@/lib/labor-pin";
import { assertPinLoginQuota } from "@/lib/fnb-quota";
import {
  ensureSystemFnbRoles,
  resolveFnbEdition,
} from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import {
  effectiveRolePermissions,
  pinRoleToCode,
} from "@/lib/auth/permissions";
import { OUTLET_COOKIE } from "@/lib/outlet-session";
import {
  readTerminalCookie,
  terminalCookieHeader,
} from "@/lib/terminal-cookie";

const PIN_FAIL_LIMIT = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

const schema = z.object({
  staffId: z.string().min(1),
  pin: z.string().min(4).max(8),
});

export async function POST(request: Request) {
  try {
    const raw = terminalCookieHeader(request);
    const terminal = readTerminalCookie(raw);
    if (!terminal) return jsonError("TERMINAL_REQUIRED", 401);

    const body = schema.parse(await request.json());
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    assertPinLoginQuota(ip);

    enterSatelliteTenant({ organizationId: terminal.organizationId });
    const outlet = await prisma.outlet.findFirst({
      where: {
        id: terminal.outletId,
        organizationId: terminal.organizationId,
        active: true,
      },
    });
    if (
      !outlet ||
      (outlet.terminalRevokedAt && outlet.terminalRevokedAt.getTime() >= terminal.boundAt)
    ) {
      return jsonError("TERMINAL_REQUIRED", 401);
    }

    const profile = await getFnbOrgProfile(terminal.organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureSystemFnbRoles(prisma, terminal.organizationId, edition);

    const staff = await prisma.staffRoster.findFirst({
      where: {
        id: body.staffId,
        organizationId: terminal.organizationId,
        active: true,
      },
    });
    if (!staff || staff.outletId !== outlet.id) {
      pinMatches(null, body.pin);
      return jsonError("Invalid PIN", 401);
    }
    if (staff.pinLockedUntil && staff.pinLockedUntil.getTime() > Date.now()) {
      return jsonError("PIN_LOCKED", 429);
    }
    if (!pinMatches(staff.pinHash, body.pin)) {
      const fails = staff.pinFailCount + 1;
      await prisma.staffRoster.update({
        where: { id: staff.id },
        data: {
          pinFailCount: fails,
          pinLockedUntil: fails >= PIN_FAIL_LIMIT ? new Date(Date.now() + PIN_LOCK_MS) : null,
        },
      });
      return jsonError(fails >= PIN_FAIL_LIMIT ? "PIN_LOCKED" : "Invalid PIN", fails >= PIN_FAIL_LIMIT ? 429 : 401);
    }

    await prisma.staffRoster.update({
      where: { id: staff.id },
      data: { pinFailCount: 0, pinLockedUntil: null },
    });

    const roleCode = pinRoleToCode(staff.pinRole);
    const role = await prisma.role.findFirst({
      where: { organizationId: terminal.organizationId, code: roleCode },
    });
    const permissions = role
      ? effectiveRolePermissions(role.code, role.permissionsJson, edition)
      : [];

    const token = await signSatelliteSession({
      sub: staff.id,
      login: staff.staffCode,
      role: roleCode,
      fullName: staff.fullName,
      organizationId: terminal.organizationId,
      permissions,
      pin: true,
      outletId: staff.outletId ?? undefined,
    });
    const res = jsonOk({
      user: {
        id: staff.id,
        login: staff.staffCode,
        fullName: staff.fullName,
        role: roleCode,
        organizationId: terminal.organizationId,
        outletId: staff.outletId,
        pin: true,
        permissions,
      },
      token,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    res.cookies.set(OUTLET_COOKIE, staff.outletId ?? "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
