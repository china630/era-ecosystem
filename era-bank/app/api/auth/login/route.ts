import {
  ORG_NO_RE,
  authCookieName,
  enterSatelliteTenant,
  jsonLoginHostBinding,
  readStaffLoginJson,
  resolveSatelliteOrganizationId,
  resolveStaffLoginTenant,
  satelliteRuntimeConfig,
  signSatelliteSession,
  verifySatelliteUserPassword,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
} from "@/lib/auth/permissions";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** SHARED pool: required. Appliance: omit → process bind only. */
  orgNo: z.string().regex(ORG_NO_RE).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await readStaffLoginJson(request);
    if (!rawBody.ok) {
      return jsonError(rawBody.error, rawBody.status);
    }
    const body = schema.parse(rawBody.raw);
    const tenant = await resolveStaffLoginTenant({
      orgNo: body.orgNo,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
      request,
    });
    if (!tenant.ok) {
      return jsonError(tenant.error, tenant.status);
    }

    let organizationId = tenant.organizationId?.trim() || "";
    if (!organizationId) {
      try {
        organizationId = resolveSatelliteOrganizationId().organizationId;
      } catch {
        organizationId = "";
      }
    }

    // Enter ALS before OpsUser lookup so the Prisma tenant extension cannot
    // AND-merge leftover process bind (compose ERA_BANK_ORGANIZATION_ID) against
    // a different orgNo UUID on SHARED.
    if (organizationId) {
      enterSatelliteTenant({ organizationId });
    }

    const username = body.login.trim();
    const user = organizationId
      ? await prisma.opsUser.findFirst({
          where: { organizationId, username },
          include: { opsRole: true },
        })
      : null;

    if (
      !(await verifySatelliteUserPassword(body.password, {
        passwordHash: user?.passwordHash ?? "",
        status: user?.status ?? "CLOSED",
      })) ||
      !user
    ) {
      return jsonError("Invalid credentials", 401);
    }

    await ensureSystemBankRoles(prisma, user.organizationId);

    const role = await prisma.opsRole.findUniqueOrThrow({
      where: { id: user.opsRoleId },
    });

    const bypass = hasBankPermissionBypass({
      login: user.username,
      role: role.code,
      isOwner: role.code === "BUSINESS_OWNER",
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(role.code, role.permissionsJson);

    await prisma.opsSession.create({
      data: {
        opsUserId: user.id,
        branchId: user.branchId,
      },
    });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.username,
      role: role.code,
      fullName: user.fullName,
      organizationId: user.organizationId,
      permissions,
      isOwner: role.code === "BUSINESS_OWNER",
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: role.code,
        branchId: user.branchId,
        organizationId: user.organizationId,
        permissions,
      },
      token,
    });

    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });

    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(request: Request) {
  return jsonLoginHostBinding(request);
}
