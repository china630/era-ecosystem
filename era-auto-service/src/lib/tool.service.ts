import { prisma } from "@/lib/prisma";

export async function listTools() {
  return prisma.tool.findMany({
    include: {
      checkouts: { where: { returnedAt: null }, take: 5 },
    },
  });
}

export async function upsertTool(code: string, name: string) {
  return prisma.tool.upsert({
    where: { code },
    create: { code, name },
    update: { name },
  });
}

export async function findToolById(id: string) {
  return prisma.tool.findUnique({ where: { id } });
}

export async function findOpenToolCheckout(toolId: string) {
  return prisma.toolCheckout.findFirst({
    where: { toolId, returnedAt: null },
    orderBy: { checkedOutAt: "desc" },
  });
}

export async function returnToolCheckout(checkoutId: string) {
  return prisma.toolCheckout.update({
    where: { id: checkoutId },
    data: { returnedAt: new Date() },
  });
}

export async function createToolCheckout(toolId: string, checkedOutBy: string) {
  return prisma.toolCheckout.create({
    data: { toolId, checkedOutBy },
  });
}
