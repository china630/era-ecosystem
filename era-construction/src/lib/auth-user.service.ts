import { prisma } from "@/lib/prisma";

export async function findUserWithRoleById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
}

export async function findUserProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, login: true, email: true, fullName: true },
  });
}
