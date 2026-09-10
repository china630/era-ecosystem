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
  DEFAULT_ROLE_PERMISSIONS,
  effectiveRolePermissions,
  isClinicPermission,
  parseRolePermissions,
  serializeRolePermissions,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";
import { isSystemClinicRoleCode } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordClinicAudit } from "@/lib/satellite-audit";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const gate = await assertClinicAdminRoute(_req);
    if (gate.error) return gate.error;

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    const permissions = effectiveRolePermissions(role.code, role.permissionsJson);
    return jsonOk({
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      staffKind: role.staffKind,
      cloneFromCode: role.cloneFromCode,
      permissions,
      customized: parseRolePermissions(role.permissionsJson).length > 0,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

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
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    let next: ClinicPermission[];
    if (body.resetToDefaults) {
      if (isSystemClinicRoleCode(code) && DEFAULT_ROLE_PERMISSIONS[code]) {
        next = [...DEFAULT_ROLE_PERMISSIONS[code]];
      } else if (role.cloneFromCode) {
        const donor = await prisma.role.findFirst({
          where: { organizationId, code: role.cloneFromCode },
        });
        if (!donor) {
          return jsonError("cloneFrom role missing; cannot reset", 400);
        }
        next = effectiveRolePermissions(donor.code, donor.permissionsJson);
      } else {
        return jsonError("No defaults available for this role", 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isClinicPermission(p));
      if (invalid.length > 0) {
        return jsonError("Unknown permission codes", 400, { invalid });
      }
      next = body.permissions as ClinicPermission[];
    } else {
      return jsonError("permissions or resetToDefaults required", 400);
    }

    const before = parseRolePermissions(role.permissionsJson);
    const updated = await prisma.role.update({
      where: { id: role.id },
      data: { permissionsJson: serializeRolePermissions(next) },
    });

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "Role",
      role.id,
      "PERMISSIONS_UPDATE",
      {
        roleCode: code,
        before,
        after: next,
        resetToDefaults: body.resetToDefaults === true,
      },
    );

    return jsonOk({
      code: updated.code,
      permissions: next,
      customized: true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
