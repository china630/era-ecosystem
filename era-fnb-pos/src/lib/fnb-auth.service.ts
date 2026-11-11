import {
  authenticateIndustryStaffLogin,
  executeSatelliteSsoExchange,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import type { SsoExchangeBody } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { ensureSystemFnbRoles, resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import type { FnbEdition } from "@/lib/auth/permissions";

export async function authenticateFnbStaffLogin(request: Request) {
  return authenticateIndustryStaffLogin({
    request,
    prisma,
    isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
  });
}

export async function ensureFnbSystemRoles(
  organizationId: string,
  edition: FnbEdition,
): Promise<void> {
  await ensureSystemFnbRoles(prisma, organizationId, edition);
}

export function findUserWithRoleById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
}

export function findUserWithRoleBySub(sub: string) {
  return prisma.user.findFirst({
    where: { id: sub },
    include: { role: true },
  });
}

export function touchUserLastLogin(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

export function findActiveOutletForMe(outletId: string, organizationId: string) {
  return prisma.outlet.findFirst({
    where: { id: outletId, organizationId, active: true },
    select: {
      id: true,
      code: true,
      name: true,
      capTill: true,
      capTables: true,
      capBuffetPlanner: true,
      shapeHint: true,
    },
  });
}

export async function executeFnbSsoExchange(
  body: SsoExchangeBody & { financeRole: string },
) {
  return executeSatelliteSsoExchange(body, prisma);
}

export function findLiveTerminalOutlet(outletId: string, organizationId: string) {
  return prisma.outlet.findFirst({
    where: { id: outletId, organizationId, active: true },
  });
}

export function findOutletForPinLogin(outletId: string, organizationId: string) {
  return prisma.outlet.findFirst({
    where: { id: outletId, organizationId, active: true },
  });
}

export function listTillCapableOutlets(organizationId: string) {
  return prisma.outlet.findMany({
    where: { organizationId, active: true, capTill: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, shapeHint: true },
  });
}

export function findOutletForTerminalBind(outletId: string, organizationId: string) {
  return prisma.outlet.findFirst({
    where: { id: outletId, organizationId, active: true },
  });
}

export { resolveFnbEdition };
