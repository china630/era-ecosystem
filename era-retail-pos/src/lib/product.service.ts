import { searchFinanceCatalog } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export async function refreshProductCacheFromFinance(
  organizationId: string,
  search: string,
): Promise<void> {
  const result = await searchFinanceCatalog({
    organizationId,
    search: search || undefined,
    limit: 50,
    channel: "RETAIL",
  });
  if (result.source !== "finance" || result.items.length === 0) return;
  for (const item of result.items) {
    const existing = await prisma.productCache.findFirst({
      where: { organizationId, sku: item.sku },
    });
    const nextPrice =
      item.unitPrice != null ? item.unitPrice : existing ? Number(existing.unitPrice) : 0;
    const row = existing
      ? await prisma.productCache.update({
          where: { id: existing.id },
          data: {
            description: item.name,
            revenueAccountCode: item.revenueAccountCode,
            ...(item.unitPrice != null ? { unitPrice: item.unitPrice } : {}),
            syncedAt: new Date(),
          },
        })
      : await prisma.productCache.create({
          data: {
            organizationId,
            sku: item.sku,
            description: item.name,
            unitPrice: nextPrice,
            revenueAccountCode: item.revenueAccountCode,
          },
        });
    const previous = existing ? Number(existing.unitPrice) : null;
    if (item.unitPrice != null && previous !== item.unitPrice) {
      await prisma.productPrice.create({
        data: { organizationId, productId: row.id, unitPrice: item.unitPrice },
      });
    }
  }
}

export async function listProductCacheDefault() {
  return prisma.productCache.findMany({ take: 20, orderBy: { sku: "asc" } });
}

export async function searchProductCache(q: string) {
  return prisma.productCache.findMany({
    where: {
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 20,
  });
}

export async function listProductsForAdmin() {
  return prisma.productCache.findMany({
    orderBy: { sku: "asc" },
    select: {
      id: true,
      sku: true,
      description: true,
      revenueCode: true,
      categoryId: true,
    },
  });
}

export async function getProductCacheById(id: string) {
  return prisma.productCache.findUnique({ where: { id } });
}

export async function updateProductCategoryId(id: string, categoryId: string | null | undefined) {
  return prisma.productCache.update({
    where: { id },
    data: {
      ...(categoryId !== undefined ? { categoryId } : {}),
    },
  });
}
