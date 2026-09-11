import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  canMutateCustomRoleMeta,
  canDeleteClinicRole,
  parseAssignableStaffKind,
} from "@/lib/auth/clinic-role-admin";
import {
  parseClinicRoleStaffKind,
  type ClinicRoleStaffKind,
} from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordClinicAudit } from "@/lib/satellite-audit";

type RouteParams = { params: Promise<{ code: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  staffKind: z.enum(["DOCTOR", "NURSE", "LAB", "NONE"]).optional(),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const denied = await requireClinicPermission(
      gate.session,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    );
    if (denied) return denied;

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const body = patchSchema.parse(await req.json());
    if (body.name === undefined && body.staffKind === undefined) {
      return jsonError("name or staffKind required", 400);
    }

    const role = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    if (body.staffKind !== undefined && !canMutateCustomRoleMeta(role)) {
      return jsonError("Cannot change staffKind on a system role", 400);
    }
    if (body.name !== undefined && !canMutateCustomRoleMeta(role)) {
      return jsonError("Cannot rename a system role", 400);
    }

    const before = {
      name: role.name,
      staffKind: parseClinicRoleStaffKind(role.staffKind),
    };
    const data: { name?: string; staffKind?: ClinicRoleStaffKind } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.staffKind !== undefined) {
      const kind = parseAssignableStaffKind(body.staffKind);
      if (!kind) return jsonError("Invalid staffKind", 400);
      data.staffKind = kind;
    }

    const updated = await prisma.role.update({
      where: { id: role.id },
      data,
    });

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "Role",
      role.id,
      "ROLE_UPDATE",
      {
        code: role.code,
        before,
        after: {
          name: updated.name,
          staffKind: parseClinicRoleStaffKind(updated.staffKind),
        },
      },
    );

    return jsonOk({
      code: updated.code,
      name: updated.name,
      isSystem: updated.isSystem,
      staffKind: parseClinicRoleStaffKind(updated.staffKind),
      cloneFromCode: updated.cloneFromCode,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const denied = await requireClinicPermission(
      gate.session,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    );
    if (denied) return denied;

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return jsonError("Role not found", 404);
    const deletable = canDeleteClinicRole({
      isSystem: role.isSystem,
      code: role.code,
      userCount: role._count.users,
    });
    if (!deletable.ok) {
      if (deletable.reason === "system") {
        return jsonError("Cannot delete a system role", 400);
      }
      return jsonError("Role still has users", 409, {
        userCount: role._count.users,
      });
    }

    await prisma.role.delete({ where: { id: role.id } });
    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "Role",
      role.id,
      "ROLE_DELETE",
      { code: role.code, name: role.name },
    );

    return jsonOk({ deleted: true, code: role.code });
  } catch (err) {
    return handleRouteError(err);
  }
}
