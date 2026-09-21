import {
  jsonOk,
  handleRouteError,
} from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

/** List local staff users for role assignment on /admin/access. */
export async function GET(req: Request) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const organizationId = requestOrganizationId();
    await ensureSystemClinicRoles(prisma, organizationId);

    const users = await prisma.user.findMany({
      where: { organizationId },
      orderBy: [{ fullName: "asc" }, { login: "asc" }],
      select: {
        id: true,
        login: true,
        fullName: true,
        email: true,
        status: true,
        isCrossSystem: true,
        role: {
          select: {
            code: true,
            name: true,
            isSystem: true,
            staffKind: true,
          },
        },
      },
    });

    return jsonOk(
      users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        isCrossSystem: u.isCrossSystem,
        roleCode: u.role.code,
        roleName: u.role.name,
        roleIsSystem: u.role.isSystem,
        staffKind: parseClinicRoleStaffKind(u.role.staffKind),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
