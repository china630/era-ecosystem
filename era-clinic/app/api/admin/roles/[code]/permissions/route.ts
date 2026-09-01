import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import {
  assertClinicAdminRoute,
} from "@/lib/auth/clinic-admin-guard";
import {
  CONFIGURABLE_CLINIC_ROLES,
  CLINIC_PERMISSION,
  DEFAULT_ROLE_PERMISSIONS,
  isClinicPermission,
  parseRolePermissions,
  serializeRolePermissions,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

function isConfigurableRole(code: string): boolean {
  return (CONFIGURABLE_CLINIC_ROLES as readonly string[]).includes(code);
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const gate = await assertClinicAdminRoute(_req);
    if (gate.error) return gate.error;

    const { code } = await params;
    if (!isConfigurableRole(code)) {
      return jsonError("Role not configured for matrix", 404);
    }

    const role = await prisma.role.findFirst({ where: { code } });
    if (!role) return jsonError("Role not found", 404);

    const stored = parseRolePermissions(role.permissionsJson);
    const permissions =
      stored.length > 0
        ? stored
        : (DEFAULT_ROLE_PERMISSIONS[code as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? []);

    return jsonOk({
      code: role.code,
      name: role.name,
      permissions,
      customized: stored.length > 0,
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
    if (!isConfigurableRole(code)) {
      return jsonError("Role not configured for matrix", 404);
    }

    const body = patchSchema.parse(await req.json());
    const role = await prisma.role.findFirst({ where: { code } });
    if (!role) return jsonError("Role not found", 404);

    let next: ClinicPermission[];
    if (body.resetToDefaults) {
      next = DEFAULT_ROLE_PERMISSIONS[code as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
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
