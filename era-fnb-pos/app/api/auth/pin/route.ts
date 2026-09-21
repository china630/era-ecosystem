import {
  ORG_NO_RE,
  authCookieName,
  enterSatelliteTenant,
  readStaffLoginJson,
  resolveStaffLoginTenant,
  satelliteOrganizationId,
  satelliteRuntimeConfig,
  signSatelliteSession,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { hashStaffPin, pinMatches } from "@/lib/labor-pin";
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

const schema = z.object({
  pin: z.string().min(4).max(8),
  orgNo: z.string().regex(ORG_NO_RE).optional(),
  outletId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const rawBody = await readStaffLoginJson(request);
    if (!rawBody.ok) {
      return jsonError(rawBody.error, rawBody.status);
    }
    const body = schema.parse(rawBody.raw);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    assertPinLoginQuota(ip);

    const tenant = await resolveStaffLoginTenant({
      orgNo: body.orgNo,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
      request,
    });
    if (!tenant.ok) {
      return jsonError(tenant.error, tenant.status);
    }

    const organizationId = tenant.organizationId?.trim() || satelliteOrganizationId();
    if (!organizationId) {
      return jsonError("orgNo is required on SHARED pool", 400);
    }
    enterSatelliteTenant({ organizationId });

    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition, profile.hotelMode);
    await ensureSystemFnbRoles(prisma, organizationId, edition);

    const pinHash = hashStaffPin(body.pin);
    const staff = await prisma.staffRoster.findFirst({
      where: {
        organizationId,
        pinHash,
        active: true,
      },
    });
    if (!staff) {
      pinMatches(null, body.pin);
      return jsonError("Invalid PIN", 401);
    }

    if (!staff.outletId) {
      return jsonError("PIN_OUTLET_UNBOUND", 403);
    }
    if (staff.outletId !== body.outletId) {
      return jsonError("Invalid PIN", 401);
    }

    const roleCode = pinRoleToCode(staff.pinRole);
    const role = await prisma.role.findFirst({
      where: { organizationId, code: roleCode },
    });
    const permissions = role
      ? effectiveRolePermissions(role.code, role.permissionsJson, edition)
      : [];

    const token = await signSatelliteSession({
      sub: staff.id,
      login: staff.staffCode,
      role: roleCode,
      fullName: staff.fullName,
      organizationId,
      permissions,
      pin: true,
      outletId: staff.outletId,
    });
    const res = jsonOk({
      user: {
        id: staff.id,
        login: staff.staffCode,
        fullName: staff.fullName,
        role: roleCode,
        organizationId,
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
    res.cookies.set(OUTLET_COOKIE, staff.outletId, {
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
