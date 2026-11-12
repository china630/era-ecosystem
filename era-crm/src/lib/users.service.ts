import { prisma } from "@/lib/prisma";

const AGENT_ROLES = ["SALES_AGENT", "SALES_LEAD", "BUSINESS_OWNER"];

export async function listActiveAgentUsers() {
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { code: { in: AGENT_ROLES } },
    },
    select: {
      id: true,
      login: true,
      fullName: true,
      role: { select: { code: true } },
    },
    orderBy: { fullName: "asc" },
  });
}

export async function findUserProfileById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, login: true, email: true, fullName: true },
  });
}

export async function findUserWithRoleById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
}
