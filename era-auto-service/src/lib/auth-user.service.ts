import { prisma } from "@/lib/prisma";

export async function findUserWithRoleById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
}

export async function findUserProfileById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, login: true, email: true, fullName: true },
  });
}
