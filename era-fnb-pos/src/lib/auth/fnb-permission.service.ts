import { prisma } from "@/lib/prisma";
import {
  effectiveRolePermissions,
  type FnbEdition,
  type Permission,
} from "@/lib/auth/permissions";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";

export async function permissionsForRoleCode(
  organizationId: string,
  roleCode: string,
): Promise<Permission[]> {
  const profile = await getFnbOrgProfile(organizationId);
  const edition = resolveFnbEdition(profile.edition, profile.hotelMode);
  const role = await prisma.role.findFirst({
    where: { organizationId, code: roleCode },
  });
  if (!role) {
    return [];
  }
  return effectiveRolePermissions(role.code, role.permissionsJson, edition);
}

export async function permissionsForUserId(
  userId: string,
): Promise<Permission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) return [];
  const profile = await getFnbOrgProfile(user.organizationId);
  const edition = resolveFnbEdition(profile.edition, profile.hotelMode);
  return effectiveRolePermissions(
    user.role.code,
    user.role.permissionsJson,
    edition,
  );
}

export async function editionForOrg(
  organizationId: string,
): Promise<FnbEdition> {
  const profile = await getFnbOrgProfile(organizationId);
  return resolveFnbEdition(profile.edition, profile.hotelMode);
}
