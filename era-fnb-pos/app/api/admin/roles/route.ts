import { z } from "zod";
import { assertFnbEntitled, jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { assertAnyPermission, assertPermission } from "@/lib/auth/require";
import {
  PERMISSIONS,
  effectiveRolePermissions,
  parsePermissions,
  serializePermissions,
} from "@/lib/auth/permissions";
import {
  ensureSystemFnbRoles,
  FNB_PERMISSION_CATALOG_VERSION,
} from "@/lib/auth/ensure-system-fnb-roles";
import {
  FNB_CUSTOM_ROLE_CODE_RE,
  isValidCustomFnbRoleCode,
  normalizeFnbRoleCode,
} from "@/lib/auth/fnb-role-admin";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { editionForOrg } from "@/lib/auth/fnb-permission.service";

const createSchema = z.object({
  code: z.string().regex(FNB_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    assertAnyPermission(session, [PERMISSIONS.ACCESS_MANAGE]);

    const organizationId = requestOrganizationId();
    const edition = await editionForOrg(organizationId);
    await ensureSystemFnbRoles(prisma, organizationId, edition);

    const roles = await prisma.role.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
      include: { _count: { select: { users: true } } },
    });

    return jsonOk(
      roles.map((role) => {
        const permissions = effectiveRolePermissions(
          role.code,
          role.permissionsJson,
          edition,
        );
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          isSystem: role.isSystem,
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: permissions.length,
          permissions,
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
    await assertFnbEntitled();
    const session = await getSessionFromRequest(req);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const organizationId = requestOrganizationId();
    const edition = await editionForOrg(organizationId);
    await ensureSystemFnbRoles(prisma, organizationId, edition);

    const body = createSchema.parse(await req.json());
    const code = normalizeFnbRoleCode(body.code);
    if (!isValidCustomFnbRoleCode(code)) {
      return jsonError("Cannot create a role with a reserved system code", 400);
    }

    const existing = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (existing) {
      return jsonError("Role code already exists", 409);
    }

    const donor = await prisma.role.findFirst({
      where: { organizationId, code: body.cloneFrom },
    });
    if (!donor) {
      return jsonError("cloneFrom role not found", 404);
    }

    const permissions = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
      edition,
    );
    const created = await prisma.role.create({
      data: {
        organizationId,
        code,
        name: body.name,
        isSystem: false,
        cloneFromCode: donor.code,
        permissionsJson: serializePermissions(permissions),
        permissionCatalogVersion: FNB_PERMISSION_CATALOG_VERSION,
      },
    });

    await recordFbAudit(
      { userId: session!.sub, request: req },
      "Role",
      created.id,
      "ROLE_CREATE",
      { code: created.code, cloneFrom: donor.code },
    );

    return jsonOk(
      {
        id: created.id,
        code: created.code,
        name: created.name,
        isSystem: false,
        cloneFromCode: created.cloneFromCode,
        permissions,
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
