import type { PrismaClient } from "@prisma/client";
import {
  CLINIC_ROLE,
  SYSTEM_CLINIC_ROLES,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_STAFF_KIND,
  type ClinicRoleCode,
} from "@/lib/clinic-roles";
import {
  CLINIC_PERMISSION,
  CLINIC_PERMISSION_CATALOG_VERSION,
  type ClinicPermission,
  expandClinicCatalog,
  parseRolePermissions,
  permissionsJsonForRole,
  permissionsJsonNeedsTemplate,
  serializeRolePermissions,
} from "@/lib/auth/clinic-permissions";

type RoleDb = Pick<PrismaClient, "role">;

/**
 * Upsert the six system ops roles for an organization.
 * Does not overwrite a valid permissionsJson array (including intentional empty).
 * Fills missing/invalid JSON from the code template; sets isSystem + staffKind when missing.
 */
export async function ensureSystemClinicRoles(
  db: RoleDb,
  organizationId: string,
): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error("organizationId required for ensureSystemClinicRoles");

  for (const code of SYSTEM_CLINIC_ROLES) {
    await upsertSystemRole(db, orgId, code);
  }

  const findMany = (db.role as { findMany?: (args: object) => Promise<Array<{
    id: string;
    code: string;
    permissionsJson: string;
    permissionCatalogVersion?: number | null;
  }>> }).findMany;
  if (!findMany) return;
  const rows = await findMany({ where: { organizationId: orgId } });
  for (const row of rows) {
    if ((SYSTEM_CLINIC_ROLES as readonly string[]).includes(row.code)) continue;
    if ((row.permissionCatalogVersion ?? 0) >= CLINIC_PERMISSION_CATALOG_VERSION) continue;
    const current = parseRolePermissions(row.permissionsJson);
    const data: { permissionCatalogVersion: number; permissionsJson?: string } = {
      permissionCatalogVersion: CLINIC_PERMISSION_CATALOG_VERSION,
    };
    if (current.length > 0) {
      data.permissionsJson = serializeRolePermissions(expandClinicCatalog(current));
    }
    await db.role.update({ where: { id: row.id }, data });
  }
}

async function upsertSystemRole(
  db: RoleDb,
  organizationId: string,
  code: ClinicRoleCode,
): Promise<void> {
  const templateJson = permissionsJsonForRole(code);
  const staffKind = SYSTEM_ROLE_STAFF_KIND[code];
  const name = SYSTEM_ROLE_NAMES[code];

  const existing = await db.role.findFirst({
    where: { organizationId, code },
  });

  if (!existing) {
    await db.role.create({
      data: {
        organizationId,
        code,
        name,
        isSystem: true,
        staffKind,
        permissionsJson: templateJson,
        permissionCatalogVersion: CLINIC_PERMISSION_CATALOG_VERSION,
      },
    });
    return;
  }

  const patch: {
    isSystem: boolean;
    staffKind?: string;
    permissionsJson?: string;
    permissionCatalogVersion?: number;
    name?: string;
  } = { isSystem: true };

  if (existing.staffKind == null || existing.staffKind === "") {
    patch.staffKind = staffKind;
  }
  const catalogVersion =
    "permissionCatalogVersion" in existing
      ? Number((existing as { permissionCatalogVersion?: number }).permissionCatalogVersion ?? 0)
      : 0;
  if (permissionsJsonNeedsTemplate(existing.permissionsJson)) {
    patch.permissionsJson = templateJson;
    patch.permissionCatalogVersion = CLINIC_PERMISSION_CATALOG_VERSION;
  } else if (catalogVersion < CLINIC_PERMISSION_CATALOG_VERSION) {
    patch.permissionCatalogVersion = CLINIC_PERMISSION_CATALOG_VERSION;
    const current = parseRolePermissions(existing.permissionsJson);
    if (current.length > 0) {
      const template = parseRolePermissions(templateJson);
      const grant: ClinicPermission[] = [...current];
      if (
        code !== CLINIC_ROLE.CLINIC_ADMIN &&
        template.includes(CLINIC_PERMISSION.API_LAB_ORDERS_WRITE) &&
        current.includes(CLINIC_PERMISSION.API_LAB_ORDERS) &&
        !current.includes(CLINIC_PERMISSION.API_LAB_ORDERS_WRITE)
      ) {
        grant.push(CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
      }
      if (
        code !== CLINIC_ROLE.CLINIC_ADMIN &&
        template.includes(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ) &&
        current.includes(CLINIC_PERMISSION.API_LAB_ORDERS) &&
        !current.includes(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ)
      ) {
        grant.push(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ);
      }
      if (
        code === CLINIC_ROLE.CLINIC_ADMIN &&
        !current.includes(CLINIC_PERMISSION.API_HOTEL_REVENUE_CODES)
      ) {
        grant.push(CLINIC_PERMISSION.API_HOTEL_REVENUE_CODES);
      }
      patch.permissionsJson = serializeRolePermissions(expandClinicCatalog(grant));
    }
  }
  // Keep display name if already set; only fill blank.
  if (!existing.name?.trim()) {
    patch.name = name;
  }

  // Skip no-op writes when only isSystem flag and already system.
  const onlySystemFlag =
    Object.keys(patch).length === 1 &&
    patch.isSystem === true &&
    existing.isSystem === true;
  if (onlySystemFlag) return;

  await db.role.update({
    where: { id: existing.id },
    data: patch,
  });
}

/** Resolve CLINIC_ADMIN row after ensure (demo / bootstrap). */
export async function ensureClinicAdminRole(
  db: RoleDb,
  organizationId: string,
) {
  await ensureSystemClinicRoles(db, organizationId);
  const role = await db.role.findFirst({
    where: { organizationId, code: CLINIC_ROLE.CLINIC_ADMIN },
  });
  if (!role) {
    throw new Error("CLINIC_ADMIN role missing after ensureSystemClinicRoles");
  }
  return role;
}
