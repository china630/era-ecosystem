import { prisma } from "@/lib/prisma";

export async function getUserWithRoleById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
}

export async function getUserProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, login: true, email: true, fullName: true },
  });
}

export async function recordStaffLogin(data: {
  organizationId: string;
  userId: string;
  login: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  return prisma.userLogin
    .create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        login: data.login,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })
    .catch(() => undefined);
}
