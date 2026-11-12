import {
  authenticateIndustryStaffLogin,
  executeSatelliteSsoExchange,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import type { SsoExchangeBody } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export async function authenticateLogisticsStaffLogin(request: Request) {
  return authenticateIndustryStaffLogin({
    request,
    prisma,
    isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
  });
}

export function findUserWithRoleById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
}

export function findUserProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, login: true, email: true, fullName: true },
  });
}

export async function executeLogisticsSsoExchange(
  body: SsoExchangeBody & { financeRole: string },
) {
  return executeSatelliteSsoExchange(body, prisma);
}
