import { prisma } from "@/lib/prisma";
import {
  effectiveRolePermissions,
  type Permission,
} from "@/lib/auth/permissions";

export async function permissionsForUser(userId: string): Promise<Permission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) return [];
  return effectiveRolePermissions(user.role.code, user.role.permissionsJson);
}
