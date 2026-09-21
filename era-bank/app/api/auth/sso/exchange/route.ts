import {
  authCookieName,
  consumeSsoSignatureOnce,
  enterSatelliteTenant,
  mapFinanceRoleToSatellite,
  resolveVerifiedSsoFinanceRole,
  SATELLITE_ROLE,
  signSatelliteSession,
  ssoExchangeBodySchema,
  satelliteOrganizationId,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  ensureSystemBankRoles,
  BANK_PERMISSION_CATALOG_VERSION,
} from "@/lib/auth/ensure-system-bank-roles";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
  permissionsForRole,
  serializePermissions,
  SYSTEM_ROLE_NAMES,
  type RoleCode,
} from "@/lib/auth/permissions";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";

const DEMO_BRANCH_ID = "demo-branch-hq";

export async function POST(request: Request) {
  try {
    const body = ssoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError("SSO token expired", 401);
    }

    const financeRole = resolveVerifiedSsoFinanceRole({
      email: body.email,
      organizationId: body.organizationId,
      expiresAt: body.expiresAt,
      signature: body.signature,
      financeRole: body.financeRole,
      jti: body.jti,
    });
    if (!financeRole) {
      return jsonError("Invalid SSO signature", 401);
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return jsonError("SSO ticket already used", 401);
    }

    const topology = satelliteRuntimeConfig().deploymentTopology;
    let deployOrg: string | null = null;
    try {
      deployOrg = satelliteOrganizationId();
    } catch {
      deployOrg = null;
    }
    if (
      topology !== "SHARED" &&
      deployOrg &&
      deployOrg !== "demo-org" &&
      body.organizationId !== deployOrg
    ) {
      return jsonError("SSO organization mismatch", 401);
    }

    enterSatelliteTenant({ organizationId: body.organizationId });
    await ensureSystemBankRoles(prisma, body.organizationId);

    const satelliteRole = mapFinanceRoleToSatellite(financeRole) as RoleCode;
    const roleName =
      SYSTEM_ROLE_NAMES[satelliteRole] ??
      (satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER
        ? "Business Owner"
        : "Executive viewer");

    const existingRole = await prisma.opsRole.findFirst({
      where: {
        organizationId: body.organizationId,
        code: satelliteRole,
      },
    });

    const role =
      existingRole ??
      (await prisma.opsRole.create({
        data: {
          organizationId: body.organizationId,
          code: satelliteRole,
          name: roleName,
          isSystem: true,
          limitsJson: {},
          permissionsJson: serializePermissions(
            permissionsForRole(satelliteRole),
          ),
          permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
        },
      }));

    if (existingRole && existingRole.name !== roleName) {
      await prisma.opsRole.update({
        where: { id: existingRole.id },
        data: { name: roleName, isSystem: true },
      });
    }

    await ensureSystemBankRoles(prisma, body.organizationId);
    const roleFresh = await prisma.opsRole.findUniqueOrThrow({
      where: { id: role.id },
    });

    const username = `sso_${body.email.split("@")[0]}`;
    const isOwner = satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER;
    const user = await prisma.opsUser.upsert({
      where: {
        organizationId_username: {
          organizationId: body.organizationId,
          username,
        },
      },
      update: {
        fullName: body.fullName,
        passwordHash: "sso:no-password",
        branchId: DEMO_BRANCH_ID,
        opsRoleId: roleFresh.id,
        status: "ACTIVE",
      },
      create: {
        organizationId: body.organizationId,
        username,
        fullName: body.fullName,
        passwordHash: "sso:no-password",
        branchId: DEMO_BRANCH_ID,
        opsRoleId: roleFresh.id,
        status: "ACTIVE",
      },
      include: { opsRole: true },
    });

    const bypass = hasBankPermissionBypass({
      login: user.username,
      email: body.email,
      role: user.opsRole.code,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          user.opsRole.code,
          user.opsRole.permissionsJson,
        );

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.username,
      email: body.email,
      role: user.opsRole.code,
      fullName: user.fullName,
      isOwner,
      organizationId: body.organizationId,
      permissions,
      financeRole,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: user.opsRole.code,
        organizationId: body.organizationId,
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

