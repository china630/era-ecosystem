import type { PrismaClient } from "@prisma/client";
import {
  SYSTEM_FNB_ROLES,
  SYSTEM_ROLE_NAMES,
  isSystemFnbRoleCode,
  permissionsJsonNeedsTemplate,
  rolePermissionsForEdition,
  serializePermissions,
  type FnbEdition,
  type RoleCode,
} from "@/lib/auth/permissions";

export const FNB_PERMISSION_CATALOG_VERSION = 1;

type RoleRow = {
  id: string;
  code: string;
  name: string;
  permissionsJson: string;
  isSystem: boolean;
  cloneFromCode: string | null;
  permissionCatalogVersion?: number | null;
};

type RoleDb = {
  role: {
    findFirst: (args: {
      where: { organizationId: string; code: string };
    }) => Promise<RoleRow | null>;
    findMany?: (args: {
      where: { organizationId: string };
    }) => Promise<RoleRow[]>;
    create: (args: {
      data: {
        organizationId: string;
        code: string;
        name: string;
        isSystem: boolean;
        permissionsJson: string;
        permissionCatalogVersion: number;
        cloneFromCode?: string | null;
      };
    }) => Promise<RoleRow>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<RoleRow>;
  };
};

export function resolveFnbEdition(
  edition: string | null | undefined,
  hotelMode?: boolean | null,
): FnbEdition {
  if (edition?.toLowerCase() === "kafe") return "kafe";
  if (hotelMode === false) return "kafe";
  return "hotel";
}

/**
 * Upsert the four system F&B roles for an organization.
 * Does not overwrite a valid permissionsJson array (including intentional empty).
 * Template grants depend on edition (hotel vs kafe — waiter pay).
 */
export async function ensureSystemFnbRoles(
  db: RoleDb | Pick<PrismaClient, "role">,
  organizationId: string,
  edition: FnbEdition = "hotel",
): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error("organizationId required for ensureSystemFnbRoles");

  for (const code of SYSTEM_FNB_ROLES) {
    await upsertSystemRole(db as RoleDb, orgId, code, edition);
  }

  if (typeof (db as RoleDb).role.findMany === "function") {
    const all = await (db as RoleDb).role.findMany!({
      where: { organizationId: orgId },
    });
    for (const row of all) {
      if (isSystemFnbRoleCode(row.code)) continue;
      await bumpCatalogVersionIfNeeded(db as RoleDb, row, edition);
    }
  }
}

async function upsertSystemRole(
  db: RoleDb,
  organizationId: string,
  code: RoleCode,
  edition: FnbEdition,
): Promise<void> {
  const templateJson = serializePermissions(
    rolePermissionsForEdition(code, edition),
  );
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
        permissionsJson: templateJson,
        permissionCatalogVersion: FNB_PERMISSION_CATALOG_VERSION,
      },
    });
    return;
  }

  const patch: {
    isSystem: boolean;
    permissionsJson?: string;
    name?: string;
    permissionCatalogVersion?: number;
  } = { isSystem: true };

  if (permissionsJsonNeedsTemplate(existing.permissionsJson)) {
    patch.permissionsJson = templateJson;
  }
  if (!existing.name?.trim()) {
    patch.name = name;
  }
  const ver = existing.permissionCatalogVersion ?? 0;
  if (ver < FNB_PERMISSION_CATALOG_VERSION) {
    patch.permissionCatalogVersion = FNB_PERMISSION_CATALOG_VERSION;
  }

  if (
    patch.permissionsJson !== undefined ||
    patch.name !== undefined ||
    patch.permissionCatalogVersion !== undefined ||
    !existing.isSystem
  ) {
    await db.role.update({
      where: { id: existing.id },
      data: patch,
    });
  }
}

async function bumpCatalogVersionIfNeeded(
  db: RoleDb,
  row: RoleRow,
  _edition: FnbEdition,
): Promise<void> {
  const ver = row.permissionCatalogVersion ?? 0;
  if (ver >= FNB_PERMISSION_CATALOG_VERSION) return;
  await db.role.update({
    where: { id: row.id },
    data: { permissionCatalogVersion: FNB_PERMISSION_CATALOG_VERSION },
  });
}

/** Reset role grants to template (system) or donor (custom). */
export function templatePermissionsForReset(
  row: { code: string; cloneFromCode: string | null },
  edition: FnbEdition,
) {
  if (isSystemFnbRoleCode(row.code)) {
    return rolePermissionsForEdition(row.code, edition);
  }
  const donor = row.cloneFromCode?.trim();
  if (donor && isSystemFnbRoleCode(donor)) {
    return rolePermissionsForEdition(donor, edition);
  }
  return [];
}
