import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  CLINIC_PERMISSION,
  effectiveRolePermissions,
  parseRolePermissions,
  serializeRolePermissions,
} from "@/lib/auth/clinic-permissions";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import {
  CLINIC_CUSTOM_ROLE_CODE_RE,
  isValidCustomClinicRoleCode,
  normalizeClinicRoleCode,
} from "@/lib/auth/clinic-role-admin";
import {
  parseClinicRoleStaffKind,
} from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordClinicAudit } from "@/lib/satellite-audit";

const createSchema = z.object({
  code: z.string().regex(CLINIC_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(32),
});

export async function GET(req: Request) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const organizationId = requestOrganizationId();
    await ensureSystemClinicRoles(prisma, organizationId);

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
          staffKind: parseClinicRoleStaffKind(role.staffKind),
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: permissions.length,
          permissions,
          customized: parseRolePermissions(role.permissionsJson).length > 0,
        };
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const denied = await requireClinicPermission(
      gate.session,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    );
    if (denied) return denied;

    const organizationId = requestOrganizationId();
    await ensureSystemClinicRoles(prisma, organizationId);

    const body = createSchema.parse(await req.json());
    const code = normalizeClinicRoleCode(body.code);
    if (!isValidCustomClinicRoleCode(code)) {
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
        staffKind: parseClinicRoleStaffKind(donor.staffKind),
        cloneFromCode: donor.code,
        permissionsJson: serializeRolePermissions(permissions),
      },
    });

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
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
      staffKind: parseClinicRoleStaffKind(created.staffKind),
      cloneFromCode: created.cloneFromCode,
      permissions,
      customized: true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
