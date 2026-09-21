import { UserRole, type PrismaClient } from "@era365/database";
import {
  permissionsJsonForCpRole,
  permissionsJsonNeedsTemplate,
  SYSTEM_CP_ROLE_CODES,
  SYSTEM_CP_ROLE_NAMES,
} from "./cp-permissions";

type RoleDb = Pick<PrismaClient, "organizationRole">;

/**
 * Upsert the 12 system UserRole packages per organization.
 * Valid permissionsJson array (including intentional []) is left alone.
 */
export async function ensureSystemCpRoles(
  db: RoleDb,
  organizationId: string,
): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error("organizationId required for ensureSystemCpRoles");

  for (const code of SYSTEM_CP_ROLE_CODES) {
    await upsertSystemRole(db, orgId, code);
  }
}

async function upsertSystemRole(
  db: RoleDb,
  organizationId: string,
  code: UserRole,
): Promise<void> {
  const templateJson = permissionsJsonForCpRole(code);
  const name = SYSTEM_CP_ROLE_NAMES[code];

  const existing = await db.organizationRole.findFirst({
    where: { organizationId, code },
  });

  if (!existing) {
    await db.organizationRole.create({
      data: {
        organizationId,
        code,
        name,
        isSystem: true,
        permissionsJson: templateJson,
        permissionCatalogVersion: 1,
      },
    });
    return;
  }

  const patch: {
    isSystem: boolean;
    permissionsJson?: string;
    name?: string;
  } = { isSystem: true };

  if (permissionsJsonNeedsTemplate(existing.permissionsJson)) {
    patch.permissionsJson = templateJson;
  }
  if (!existing.name?.trim()) {
    patch.name = name;
  }

  const onlySystemFlag =
    Object.keys(patch).length === 1 &&
    patch.isSystem === true &&
    existing.isSystem === true;
  if (onlySystemFlag) return;

  await db.organizationRole.update({
    where: { id: existing.id },
    data: patch,
  });
}
