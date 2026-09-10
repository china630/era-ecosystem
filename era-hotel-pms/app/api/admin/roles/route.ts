import { z } from "zod";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { assertAnyPermission, assertPermission } from "@/lib/auth/require";
import {
  PERMISSIONS,
  effectiveRolePermissions,
  parsePermissions,
  serializePermissions,
} from "@/lib/auth/permissions";
import { ensureSystemHotelRoles } from "@/lib/auth/ensure-system-hotel-roles";
import {
  HOTEL_CUSTOM_ROLE_CODE_RE,
  isValidCustomHotelRoleCode,
  normalizeHotelRoleCode,
} from "@/lib/auth/hotel-role-admin";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordHotelAudit } from "@/lib/satellite-audit";

const createSchema = z.object({
  code: z.string().regex(HOTEL_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertAnyPermission(session, [
      PERMISSIONS.ACCESS_MANAGE,
      PERMISSIONS.USERS_MANAGE,
    ]);

    const organizationId = requestOrganizationId();
    await ensureSystemHotelRoles(prisma, organizationId);

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
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const organizationId = requestOrganizationId();
    await ensureSystemHotelRoles(prisma, organizationId);

    const body = createSchema.parse(await req.json());
    const code = normalizeHotelRoleCode(body.code);
    if (!isValidCustomHotelRoleCode(code)) {
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
    );
    const created = await prisma.role.create({
      data: {
        organizationId,
        code,
        name: body.name,
        isSystem: false,
        cloneFromCode: donor.code,
        permissionsJson: serializePermissions(permissions),
      },
    });

    await recordHotelAudit(
      { userId: session!.sub, request: req },
      "Role",
      created.id,
      "ROLE_CREATE",
      {
        code: created.code,
        name: created.name,
        cloneFrom: donor.code,
        permissionCount: permissions.length,
      },
    );

    return jsonOk({
      id: created.id,
      code: created.code,
      name: created.name,
      isSystem: false,
      cloneFromCode: created.cloneFromCode,
      permissions,
      customized: true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
