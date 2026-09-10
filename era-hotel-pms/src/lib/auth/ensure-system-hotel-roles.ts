import type { PrismaClient } from "@prisma/client";
import {
  SYSTEM_HOTEL_ROLES,
  SYSTEM_ROLE_NAMES,
} from "@/lib/hotel-roles";
import {
  permissionsJsonNeedsTemplate,
  permissionsForRole,
  serializePermissions,
  type RoleCode,
} from "@/lib/auth/permissions";

type RoleDb = Pick<PrismaClient, "role">;

/**
 * Upsert the eight system hotel roles for an organization.
 * Does not overwrite a valid permissionsJson array (including intentional empty).
 * Fills missing/invalid JSON from the code template; sets isSystem when missing.
 */
export async function ensureSystemHotelRoles(
  db: RoleDb,
  organizationId: string,
): Promise<void> {
  const orgId = organizationId.trim();
  if (!orgId) throw new Error("organizationId required for ensureSystemHotelRoles");

  for (const code of SYSTEM_HOTEL_ROLES) {
    await upsertSystemRole(db, orgId, code);
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

  await db.role.update({
    where: { id: existing.id },
    data: patch,
  });
}

/** Resolve Hotel_Admin row after ensure (demo / bootstrap). */
export async function ensureHotelAdminRole(
  db: RoleDb,
  organizationId: string,
) {
  await ensureSystemHotelRoles(db, organizationId);
  const role = await db.role.findFirst({
    where: { organizationId, code: "Hotel_Admin" },
  });
  if (!role) {
    throw new Error("Hotel_Admin role missing after ensureSystemHotelRoles");
  }
  return role;
}
