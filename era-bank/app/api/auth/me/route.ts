import { sessionIsPlatformSuperAdmin } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { getRouteSession, jsonError } from "@/lib/api-utils";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
  sanitizeLimitsJson,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  hasBankPermissionBypass,
  sessionHasBankPermission,
} from "@/lib/auth/permission-check";

export async function GET() {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);

  const user = await prisma.opsUser.findUnique({
    where: { id: session.sub },
    include: { opsRole: true },
  });
  if (!user) return jsonError("User not found", 404);

  await ensureSystemBankRoles(prisma, user.organizationId);

  const role = await prisma.opsRole.findUniqueOrThrow({
    where: { id: user.opsRoleId },
  });

  const limits = sanitizeLimitsJson(
    (role.limitsJson ?? {}) as Record<string, unknown>,
  );
  const isPlatformSuperAdmin = sessionIsPlatformSuperAdmin(session);
  const isOwner =
    session.isOwner === true || role.code === "BUSINESS_OWNER";
  const bypass = hasBankPermissionBypass({
    login: user.username,
    email: session.email,
    role: role.code,
    isOwner,
  });
  const permissions = bypass
    ? [...ALL_PERMISSIONS]
    : effectiveRolePermissions(role.code, role.permissionsJson);

  const canApprove =
    isPlatformSuperAdmin ||
    sessionHasBankPermission(
      {
        login: user.username,
        email: session.email,
        role: role.code,
        permissions,
        isOwner,
      },
      PERMISSIONS.POSTINGS_APPROVE,
    ) ||
    sessionHasBankPermission(
      {
        login: user.username,
        email: session.email,
        role: role.code,
        permissions,
        isOwner,
      },
      PERMISSIONS.PAYMENTS_APPROVE,
    ) ||
    sessionHasBankPermission(
      {
        login: user.username,
        email: session.email,
        role: role.code,
        permissions,
        isOwner,
      },
      PERMISSIONS.LOANS_APPROVE,
    ) ||
    sessionHasBankPermission(
      {
        login: user.username,
        email: session.email,
        role: role.code,
        permissions,
        isOwner,
      },
      PERMISSIONS.DEPOSITS_APPROVE,
    ) ||
    sessionHasBankPermission(
      {
        login: user.username,
        email: session.email,
        role: role.code,
        permissions,
        isOwner,
      },
      PERMISSIONS.RISK_APPROVE,
    );

  return Response.json({
    id: user.id,
    login: user.username,
    fullName: user.fullName,
    role: role.code,
    branchId: user.branchId,
    permissions,
    canApprove,
    limitsJson: limits,
    isPlatformSuperAdmin,
    isOwner,
    organizationName: process.env.ERA_BANK_ORGANIZATION_NAME ?? "ERA Bank",
  });
}
