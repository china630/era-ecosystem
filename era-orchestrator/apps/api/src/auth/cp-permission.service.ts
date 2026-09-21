import type { PrismaClient, UserRole } from "@era365/database";
import {
  ALL_CP_PERMISSIONS,
  donorUserRoleForOrgRole,
  effectiveCpRolePermissions,
  type CpPermission,
} from "./cp-permissions";
import { ensureSystemCpRoles } from "./ensure-system-cp-roles";

type Db = Pick<PrismaClient, "organizationRole" | "organizationMembership">;

/**
 * Resolve CP + finance catalog keys for JWT from OrganizationRole.permissionsJson.
 * Ensures system roles exist. Links membership.organizationRoleId when missing.
 */
export async function resolveCpPermissionsForMembership(
  db: Db,
  input: {
    userId: string;
    organizationId: string;
    role: UserRole;
    organizationRoleId?: string | null;
    isSuperAdmin?: boolean;
    isOwner?: boolean;
  },
): Promise<CpPermission[]> {
  if (input.isSuperAdmin || input.isOwner) {
    return [...ALL_CP_PERMISSIONS];
  }

  await ensureSystemCpRoles(db, input.organizationId);

  let orgRole =
    input.organizationRoleId != null
      ? await db.organizationRole.findFirst({
          where: {
            id: input.organizationRoleId,
            organizationId: input.organizationId,
          },
        })
      : null;

  if (!orgRole) {
    orgRole = await db.organizationRole.findFirst({
      where: {
        organizationId: input.organizationId,
        code: input.role,
      },
    });
    if (orgRole) {
      await db.organizationMembership.update({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
        data: { organizationRoleId: orgRole.id },
      });
    }
  }

  if (!orgRole) {
    return effectiveCpRolePermissions(input.role, "");
  }

  return effectiveCpRolePermissions(orgRole.code, orgRole.permissionsJson);
}

export async function resolveOrgRoleRow(
  db: Pick<PrismaClient, "organizationRole">,
  organizationId: string,
  code: string,
) {
  await ensureSystemCpRoles(db as Db, organizationId);
  return db.organizationRole.findFirst({
    where: { organizationId, code },
  });
}

export { donorUserRoleForOrgRole };
