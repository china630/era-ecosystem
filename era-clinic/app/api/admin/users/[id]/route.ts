import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordClinicAudit } from "@/lib/satellite-audit";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  roleCode: z.string().trim().min(1).max(32),
});

/** Assign an existing org Role to a local user (ops RBAC). */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const denied = await requireClinicPermission(
      gate.session,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    );
    if (denied) return denied;

    const { id } = await params;
    const organizationId = requestOrganizationId();
    await ensureSystemClinicRoles(prisma, organizationId);

    const body = patchSchema.parse(await req.json());
    const roleCode = body.roleCode.trim().toUpperCase();

    const user = await prisma.user.findFirst({
      where: { id, organizationId },
      include: { role: true },
    });
    if (!user) return jsonError("User not found", 404);

    const role = await prisma.role.findFirst({
      where: { organizationId, code: roleCode },
    });
    if (!role) {
      return jsonError(
        "Role not found — create it on Access matrix first",
        404,
      );
    }

    if (user.roleId === role.id) {
      return jsonOk({
        id: user.id,
        login: user.login,
        roleCode: role.code,
        staffKind: parseClinicRoleStaffKind(role.staffKind),
        unchanged: true,
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { roleId: role.id },
      include: { role: true },
    });

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "User",
      user.id,
      "ROLE_ASSIGN",
      {
        login: user.login,
        beforeRole: user.role.code,
        afterRole: role.code,
      },
    );

    return jsonOk({
      id: updated.id,
      login: updated.login,
      roleCode: updated.role.code,
      roleName: updated.role.name,
      staffKind: parseClinicRoleStaffKind(updated.role.staffKind),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
