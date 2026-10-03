import { z } from "zod";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, PERMISSION_CATALOG_VERSION } from "@/lib/auth/permissions";
import {
  effectiveRolePermissions,
  serializePermissions,
} from "@/lib/auth/permission-catalog";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-logistics-roles";
import {
  CUSTOM_ROLE_CODE_RE,
  isValidCustomRoleCode,
  normalizeRoleCode,
} from "@/lib/auth/logistics-role-admin";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/satellite-audit";

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const organizationId = session.organizationId;
    await ensureSystemRoles(prisma, organizationId);

    const roles = await prisma.role.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
      include: { _count: { select: { users: true } } },
    });

    return jsonOk(
      roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        isSystem: role.isSystem,
        cloneFromCode: role.cloneFromCode,
        userCount: role._count.users,
        permissions: effectiveRolePermissions(role),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const organizationId = session.organizationId;
    await ensureSystemRoles(prisma, organizationId);

    const body = createSchema.parse(await req.json());
    const code = normalizeRoleCode(body.code);
    if (!isValidCustomRoleCode(code)) {
      return jsonError("Cannot create a role with a reserved system code", 400);
    }
    const existing = await prisma.role.findFirst({ where: { organizationId, code } });
    if (existing) return jsonError("Role code already exists", 409);

    const donor = await prisma.role.findFirst({
      where: { organizationId, code: normalizeRoleCode(body.cloneFrom) },
    });
    if (!donor) return jsonError("cloneFrom role not found", 404);

    const permissions = effectiveRolePermissions(donor);
    const created = await prisma.role.create({
      data: {
        organizationId,
        code,
        name: body.name,
        isSystem: false,
        cloneFromCode: donor.code,
        permissionsJson: serializePermissions(permissions),
        permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
      },
    });

    await recordAudit({ userId: session.sub, request: req }, "Role", created.id, "ROLE_CREATE", {
      code: created.code,
      cloneFrom: donor.code,
    });

    return jsonOk(
      {
        id: created.id,
        code: created.code,
        name: created.name,
        isSystem: false,
        cloneFromCode: created.cloneFromCode,
        userCount: 0,
        permissions,
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
