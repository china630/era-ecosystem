import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  CONFIGURABLE_CLINIC_ROLES,
  effectiveRolePermissions,
  parseRolePermissions,
} from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const roles = await prisma.role.findMany({
      where: { code: { in: [...CONFIGURABLE_CLINIC_ROLES] } },
      orderBy: { code: "asc" },
    });

    return jsonOk(
      roles.map((role) => {
        const permissions = effectiveRolePermissions(role.code, role.permissionsJson);
        return {
          id: role.id,
          code: role.code,
          name: role.name,
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
