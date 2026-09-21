import { z } from "zod";
import { assertBankEntitled, jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getRouteSession } from "@/lib/api-utils";
import { assertAnyPermission, assertPermission } from "@/lib/auth/require";
import {
  PERMISSIONS,
  effectiveRolePermissions,
  parsePermissions,
  serializePermissions,
} from "@/lib/auth/permissions";
import {
  ensureSystemBankRoles,
  BANK_PERMISSION_CATALOG_VERSION,
} from "@/lib/auth/ensure-system-bank-roles";
import {
  BANK_CUSTOM_ROLE_CODE_RE,
  isValidCustomBankRoleCode,
  normalizeBankRoleCode,
} from "@/lib/auth/bank-role-admin";
import { prisma } from "@/lib/prisma";
import { permissionsForUserId } from "@/lib/auth/bank-permission.service";

const createSchema = z.object({
  code: z.string().regex(BANK_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

export async function GET() {
  try {
    await assertBankEntitled();
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const permissions = await permissionsForUserId(session.sub);
    assertAnyPermission({ ...session, permissions }, [PERMISSIONS.ACCESS_MANAGE]);

    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const roles = await prisma.opsRole.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
      include: { _count: { select: { users: true } } },
    });

    return jsonOk(
      roles.map((role) => {
        const perms = effectiveRolePermissions(
          role.code,
          role.permissionsJson,
        );
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          isSystem: role.isSystem,
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: perms.length,
          permissions: perms,
          customized: parsePermissions(role.permissionsJson).length > 0,
        };
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    await assertBankEntitled();
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const permissions = await permissionsForUserId(session.sub);
    assertPermission({ ...session, permissions }, PERMISSIONS.ACCESS_MANAGE);

    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const body = createSchema.parse(await req.json());
    const code = normalizeBankRoleCode(body.code);
    if (!isValidCustomBankRoleCode(code)) {
      return jsonError("Cannot create a role with a reserved system code", 400);
    }

    const existing = await prisma.opsRole.findFirst({
      where: { organizationId, code },
    });
    if (existing) {
      return jsonError("Role code already exists", 409);
    }

    const donor = await prisma.opsRole.findFirst({
      where: { organizationId, code: body.cloneFrom },
    });
    if (!donor) {
      return jsonError("cloneFrom role not found", 404);
    }

    const donorPerms = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
    );
    const created = await prisma.opsRole.create({
      data: {
        organizationId,
        code,
        name: body.name,
        isSystem: false,
        cloneFromCode: donor.code,
        permissionsJson: serializePermissions(donorPerms),
        permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
        limitsJson: {},
      },
    });

    return jsonOk(
      {
        id: created.id,
        code: created.code,
        name: created.name,
        isSystem: false,
        cloneFromCode: created.cloneFromCode,
        permissions: donorPerms,
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
