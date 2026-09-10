import type { PrismaClient } from "@prisma/client";
import {
  CLINIC_ROLE,
  SYSTEM_CLINIC_ROLES,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_STAFF_KIND,
  type ClinicRoleCode,
} from "@/lib/clinic-roles";
import {
  parseRolePermissions,
  permissionsJsonForRole,
} from "@/lib/auth/clinic-permissions";

type RoleDb = Pick<PrismaClient, "role">;

/**
 * Upsert the six system ops roles for an organization.
 * Does not overwrite a non-empty customized permissionsJson.
 * Fills empty JSON from the code template; sets isSystem + staffKind when missing.
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
      },
    });
    return;
  }

  const stored = parseRolePermissions(existing.permissionsJson);
  const patch: {
    isSystem: boolean;
    staffKind?: string;
    permissionsJson?: string;
    name?: string;
  } = { isSystem: true };

  if (existing.staffKind == null || existing.staffKind === "") {
    patch.staffKind = staffKind;
  }
  if (stored.length === 0) {
    patch.permissionsJson = templateJson;
  }
  // Keep display name if already set; only fill blank.
  if (!existing.name?.trim()) {
    patch.name = name;
  }

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
