import {
  PERMISSION_CATALOG_VERSION,
  ROLE_TEMPLATES,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_NAMES,
  type Permission,
} from "@/lib/auth/permissions";
import {
  cutoverTemplateCode,
  isSystemRoleCode,
  permissionsForRole,
  resolveRoleCode,
  roleNeedsCutoverTemplate,
  serializePermissions,
} from "@/lib/auth/permission-catalog";

export type SeedRoleRow = {
  id: string;
  code: string;
  name: string;
  permissionsJson: string;
  isSystem: boolean;
  cloneFromCode: string | null;
  permissionCatalogVersion: number | null;
};

export type SeedRoleDb = {
  role: {
    findMany: (args: { where: { organizationId: string } }) => Promise<SeedRoleRow[]>;
    create: (args: {
      data: {
        organizationId: string;
        code: string;
        name: string;
        isSystem: boolean;
        permissionsJson: string;
        permissionCatalogVersion: number;
      };
    }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}

/**
 * Seed the system packages for one organization and cut legacy rows over once.
 * A row already on the current catalog version keeps its array, including `[]`;
 * new catalog keys reach it only through Reset or a manual grant.
 */
export async function ensureSystemRoles(db: unknown, organizationId: string): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error("organizationId required for ensureSystemRoles");
  const roleDb = (db as SeedRoleDb).role;
  const rows = await roleDb.findMany({ where: { organizationId: orgId } });
  const byCode = new Map(rows.map((row) => [row.code, row]));

  for (const code of SYSTEM_ROLE_CODES) {
    const row = byCode.get(code);
    if (!row) {
      try {
        await roleDb.create({
          data: {
            organizationId: orgId,
            code,
            name: SYSTEM_ROLE_NAMES[code],
            isSystem: true,
            permissionsJson: serializePermissions(ROLE_TEMPLATES[code]),
            permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
          },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
      continue;
    }
    const data: Record<string, unknown> = {};
    if (!row.isSystem) data.isSystem = true;
    if (!row.name?.trim()) data.name = SYSTEM_ROLE_NAMES[code];
    if (roleNeedsCutoverTemplate(row)) {
      data.permissionsJson = serializePermissions(ROLE_TEMPLATES[code]);
    }
    if ((row.permissionCatalogVersion ?? 0) < PERMISSION_CATALOG_VERSION) {
      data.permissionCatalogVersion = PERMISSION_CATALOG_VERSION;
    }
    if (Object.keys(data).length > 0) {
      await roleDb.update({ where: { id: row.id }, data });
    }
  }

  for (const row of rows) {
    if (isSystemRoleCode(row.code)) continue;
    if ((row.permissionCatalogVersion ?? 0) >= PERMISSION_CATALOG_VERSION) continue;
    const data: Record<string, unknown> = { permissionCatalogVersion: PERMISSION_CATALOG_VERSION };
    if (roleNeedsCutoverTemplate(row)) {
      const template = cutoverTemplateCode(row.code);
      data.permissionsJson = serializePermissions(ROLE_TEMPLATES[template]);
      if (!row.cloneFromCode) data.cloneFromCode = template;
    }
    await roleDb.update({ where: { id: row.id }, data });
  }
}

/** Reset target: the system template, else the donor's, else a known alias. */
export function templatePermissionsForReset(row: {
  code: string;
  cloneFromCode: string | null;
}): Permission[] {
  if (isSystemRoleCode(row.code)) return [...ROLE_TEMPLATES[row.code]];
  const donor = resolveRoleCode(row.cloneFromCode);
  if (donor) return [...ROLE_TEMPLATES[donor]];
  return permissionsForRole(row.code);
}
