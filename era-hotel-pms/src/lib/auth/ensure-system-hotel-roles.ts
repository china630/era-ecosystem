import type { PrismaClient } from "@prisma/client";
import {
  SYSTEM_HOTEL_ROLES,
  SYSTEM_ROLE_NAMES,
  isSystemHotelRoleCode,
} from "@/lib/hotel-roles";
import {
  permissionsJsonNeedsTemplate,
  permissionsForRole,
  parsePermissions,
  serializePermissions,
  PERMISSIONS,
  type Permission,
  type RoleCode,
} from "@/lib/auth/permissions";
import {
  HOTEL_LEGACY_PERMISSION_STRINGS,
  remapPermissionList,
  withPairedScreens,
} from "@/lib/auth/hotel-permission-rename";

/**
 * Wave 3: pair screen:* with api:/admin: (catalogVersion 3).
 * Wave 2: fleet-canon rename (catalogVersion 2).
 * Wave 1 additive (0→1) still applied when jumping from v0.
 */
export const HOTEL_PERMISSION_CATALOG_VERSION = 3;

/** Only these keys are one-shot-added on catalogVersion 0→1 (before Wave-2 remap). */
export const WAVE1_ADDITIVE_PERMISSIONS: Permission[] = [
  PERMISSIONS.API_IMPORT_ELEKTRAWEB,
  PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
];

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

function templateCodeForRole(row: Pick<RoleRow, "code" | "cloneFromCode">): string {
  if (isSystemHotelRoleCode(row.code)) return row.code;
  const donor = row.cloneFromCode?.trim();
  if (donor && isSystemHotelRoleCode(donor)) return donor;
  return row.code;
}

/**
 * Add Wave-1 keys that belong on this role's template without restoring stripped keys.
 * Input/output are already dual-read (canonical).
 */
export function additiveCatalogKeysForRole(
  row: Pick<RoleRow, "code" | "cloneFromCode" | "permissionsJson">,
): Permission[] {
  const template = new Set(permissionsForRole(templateCodeForRole(row)));
  const have = new Set(parsePermissions(row.permissionsJson));
  return WAVE1_ADDITIVE_PERMISSIONS.filter(
    (p) => template.has(p) && !have.has(p),
  );
}

/**
 * Upsert the eight system hotel roles for an organization.
 * Does not overwrite a valid permissionsJson array (including intentional empty).
 * Fills missing/invalid JSON from the code template; sets isSystem when missing.
 * catalogVersion < 2: Wave-1 additive (if needed) + remap legacy → fleet canon.
 */
export async function ensureSystemHotelRoles(
  db: RoleDb | Pick<PrismaClient, "role">,
  organizationId: string,
): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error("organizationId required for ensureSystemHotelRoles");

  for (const code of SYSTEM_HOTEL_ROLES) {
    await upsertSystemRole(db as RoleDb, orgId, code);
  }

  // Custom roles also need catalogVersion bump + remap / additive from clone donor.
  if (typeof (db as RoleDb).role.findMany === "function") {
    const all = await (db as RoleDb).role.findMany!({
      where: { organizationId: orgId },
    });
    for (const row of all) {
      if (isSystemHotelRoleCode(row.code)) continue;
      await bumpCatalogVersionIfNeeded(db as RoleDb, row);
    }
  }
}

async function upsertSystemRole(
  db: RoleDb,
  organizationId: string,
  code: RoleCode,
): Promise<void> {
  const templateJson = serializePermissions(permissionsForRole(code));
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
        permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION,
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
    patch.permissionCatalogVersion = HOTEL_PERMISSION_CATALOG_VERSION;
  } else {
    Object.assign(patch, bumpCatalogVersionPatch(existing));
  }

  if (!existing.name?.trim()) {
    patch.name = name;
  }

  // Skip no-op writes (important: /login and access call ensure often).
  const onlySystemFlag =
    Object.keys(patch).length === 1 && patch.isSystem === true && existing.isSystem;
  if (onlySystemFlag) return;

  await db.role.update({
    where: { id: existing.id },
    data: patch,
  });
}

async function bumpCatalogVersionIfNeeded(
  db: RoleDb,
  row: RoleRow,
): Promise<void> {
  if (permissionsJsonNeedsTemplate(row.permissionsJson)) {
    // Custom with broken JSON: leave alone (no system template overwrite).
    if ((row.permissionCatalogVersion ?? 0) < HOTEL_PERMISSION_CATALOG_VERSION) {
      await db.role.update({
        where: { id: row.id },
        data: { permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION },
      });
    }
    return;
  }
  const patch = bumpCatalogVersionPatch(row);
  if (Object.keys(patch).length === 0) return;
  await db.role.update({
    where: { id: row.id },
    data: patch,
  });
}

/**
 * Wave 1 additive (ver < 1) then Wave 2 remap of stored strings (ver < 2).
 * At v2+: heal leftover legacy strings without template union / additive.
 * Does not union the full template — strips survive.
 */
export function bumpCatalogVersionPatch(row: RoleRow): {
  permissionsJson?: string;
  permissionCatalogVersion?: number;
} {
  const ver = row.permissionCatalogVersion ?? 0;

  if (ver >= HOTEL_PERMISSION_CATALOG_VERSION) {
    return healLegacyPermissionsJson(row.permissionsJson);
  }

  let raw: string[] = [];
  try {
    const parsed = JSON.parse(row.permissionsJson) as unknown;
    if (Array.isArray(parsed)) {
      raw = parsed.map(String);
    } else {
      return { permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION };
    }
  } catch {
    return { permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION };
  }

  // Intentional empty matrix: bump version only, do not refill.
  if (raw.length === 0) {
    return { permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION };
  }

  // Dual-read / remap first so Wave-1 additive compares against canon.
  let next = remapPermissionList(raw) as Permission[];

  if (ver < 1) {
    const missing = additiveCatalogKeysForRole({
      code: row.code,
      cloneFromCode: row.cloneFromCode,
      permissionsJson: serializePermissions(next),
    });
    if (missing.length > 0) {
      next = [...next, ...missing];
    }
  }

  if (ver < 3) {
    next = withPairedScreens(next) as Permission[];
  }

  const remapped = serializePermissions(next);
  // Always rewrite JSON when remapping so legacy strings leave the DB.
  if (remapped !== row.permissionsJson || ver < HOTEL_PERMISSION_CATALOG_VERSION) {
    return {
      permissionsJson: remapped,
      permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION,
    };
  }
  return { permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION };
}

/** Rewrite leftover legacy keys at catalog v2+ without restoring stripped grants. */
function healLegacyPermissionsJson(
  permissionsJson: string,
): { permissionsJson?: string } {
  let raw: string[] = [];
  try {
    const parsed = JSON.parse(permissionsJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return {};
    raw = parsed.map(String);
  } catch {
    return {};
  }
  const hasLegacy = raw.some((p) =>
    (HOTEL_LEGACY_PERMISSION_STRINGS as readonly string[]).includes(p),
  );
  if (!hasLegacy) return {};
  const remapped = serializePermissions(remapPermissionList(raw) as Permission[]);
  if (remapped === permissionsJson) return {};
  return { permissionsJson: remapped };
}

/** Resolve Hotel_Admin row after ensure (demo / bootstrap). */
export async function ensureHotelAdminRole(
  db: RoleDb | Pick<PrismaClient, "role">,
  organizationId: string,
) {
  await ensureSystemHotelRoles(db, organizationId);
  const role = await (db as RoleDb).role.findFirst({
    where: { organizationId, code: "Hotel_Admin" },
  });
  if (!role) {
    throw new Error("Hotel_Admin role missing after ensureSystemHotelRoles");
  }
  return role;
}
