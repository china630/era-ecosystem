import { prisma } from "@/lib/prisma";

export async function listPartsCatalogEntries(vin: string) {
  return prisma.partsCatalogEntry.findMany({
    where: vin ? { OR: [{ vinPrefix: vin.slice(0, 8) }, { vinPrefix: null }] } : {},
    take: 50,
  });
}
