import { prisma } from "@/lib/prisma";
import {
  ensureSystemFnbRoles,
  FNB_PERMISSION_CATALOG_VERSION,
} from "@/lib/auth/ensure-system-fnb-roles";
import type { FnbEdition } from "@/lib/auth/permissions";

export async function ensureFnbRolesForOrg(
  organizationId: string,
  edition: FnbEdition,
): Promise<void> {
  await ensureSystemFnbRoles(prisma, organizationId, edition);
}

export function listOrganizationRoles(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export function findOrganizationRoleByCode(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
  });
}

export function findOrganizationRoleByCodeWithUserCount(
  organizationId: string,
  code: string,
) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export function createOrganizationRole(data: {
  organizationId: string;
  code: string;
  name: string;
  cloneFromCode: string;
  permissionsJson: string;
}) {
  return prisma.role.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      isSystem: false,
      cloneFromCode: data.cloneFromCode,
      permissionsJson: data.permissionsJson,
      permissionCatalogVersion: FNB_PERMISSION_CATALOG_VERSION,
    },
  });
}

export function renameOrganizationRole(roleId: string, name: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
}

export function deleteOrganizationRoleById(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}

export function patchOrganizationRolePermissions(
  roleId: string,
  permissionsJson: string,
) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson,
      permissionCatalogVersion: FNB_PERMISSION_CATALOG_VERSION,
    },
  });
}

export function findPinRoleByCode(organizationId: string, roleCode: string) {
  return prisma.role.findFirst({
    where: { organizationId, code: roleCode },
  });
}

export function listWorkforceRoleSummaries(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
}

/** @deprecated Role-name packages — use Variant A grants (`PERMISSIONS` / `denyUnlessPermission`). */
export const FB_TILL_ROLES = ["FB_WAITER", "FB_MANAGER", "FB_CASHIER"] as const;

/** @deprecated Prefer `PERMISSIONS.KDS_BUMP` grants. */
export const FB_KDS_ROLES = ["FB_KITCHEN", "FB_WAITER", "FB_MANAGER"] as const;

/**
 * @deprecated Prefer edition templates: kafe waiter omits `api:tickets.pay`.
 * Kept for error message code compatibility only.
 */
export function payRolesForKafe(kafe: boolean): string[] {
  if (kafe) return ["FB_CASHIER", "FB_MANAGER"];
  return ["FB_WAITER", "FB_MANAGER", "FB_CASHIER"];
}

export class FnbWaiterNoPayError extends Error {
  readonly status = 403;
  readonly code = "FNB_WAITER_NO_PAY";
  constructor() {
    super("Waiter PIN cannot settle the ticket — cashier or owner pays");
    this.name = "FnbWaiterNoPayError";
  }
}
