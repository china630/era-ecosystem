import type { PrismaClient } from "@prisma/client";
import {
  SYSTEM_BANK_ROLES,
  SYSTEM_ROLE_NAMES,
  isSystemBankRoleCode,
  permissionsForRole,
  permissionsJsonNeedsTemplate,
  serializePermissions,
  type RoleCode,
} from "@/lib/auth/permissions";

export const BANK_PERMISSION_CATALOG_VERSION = 1;

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
  opsRole: {
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
        limitsJson?: object;
      };
    }) => Promise<RoleRow>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<RoleRow>;
  };
};

/**
 * Upsert system bank ops roles for an organization.
 * Does not overwrite a valid permissionsJson array (including intentional empty).
 */
export async function ensureSystemBankRoles(
  db: RoleDb | Pick<PrismaClient, "opsRole">,
  organizationId: string,
): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error("organizationId required for ensureSystemBankRoles");

  for (const code of SYSTEM_BANK_ROLES) {
    await upsertSystemRole(db as RoleDb, orgId, code);
  }

  if (typeof (db as RoleDb).opsRole.findMany === "function") {
    const all = await (db as RoleDb).opsRole.findMany!({
      where: { organizationId: orgId },
    });
    for (const row of all) {
      if (isSystemBankRoleCode(row.code)) continue;
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

  const existing = await db.opsRole.findFirst({
    where: { organizationId, code },
  });

  if (!existing) {
    await db.opsRole.create({
      data: {
        organizationId,
        code,
        name,
        isSystem: true,
        permissionsJson: templateJson,
        permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
        limitsJson: defaultLimitsForRole(code),
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
  if (ver < BANK_PERMISSION_CATALOG_VERSION) {
    patch.permissionCatalogVersion = BANK_PERMISSION_CATALOG_VERSION;
  }

  if (
    patch.permissionsJson !== undefined ||
    patch.name !== undefined ||
    patch.permissionCatalogVersion !== undefined ||
    !existing.isSystem
  ) {
    await db.opsRole.update({
      where: { id: existing.id },
      data: patch,
    });
  }
}

async function bumpCatalogVersionIfNeeded(
  db: RoleDb,
  row: RoleRow,
): Promise<void> {
  const ver = row.permissionCatalogVersion ?? 0;
  if (ver >= BANK_PERMISSION_CATALOG_VERSION) return;
  await db.opsRole.update({
    where: { id: row.id },
    data: { permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION },
  });
}

function defaultLimitsForRole(code: RoleCode): object {
  switch (code) {
    case "TELLER":
      return { maxDebitMinor: 500000, dailyPostingLimitAzn: 5000 };
    case "BRANCH_MANAGER":
      return { maxDebitMinor: 5000000, dailyPostingLimitAzn: 50000 };
    default:
      return {};
  }
}

/** Reset role grants to template (system) or donor (custom). */
export function templatePermissionsForReset(row: {
  code: string;
  cloneFromCode: string | null;
}) {
  if (isSystemBankRoleCode(row.code)) {
    return permissionsForRole(row.code);
  }
  const donor = row.cloneFromCode?.trim();
  if (donor && isSystemBankRoleCode(donor)) {
    return permissionsForRole(donor);
  }
  return [];
}
