import { Prisma } from "@prisma/client";
import { searchFinanceCatalog } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

/** Pull RETAIL channel prices when a shift opens. Paid receipt lines stay as rung. */
export async function syncRetailChannelPrices(organizationId: string): Promise<number> {
  const found = await searchFinanceCatalog({
    organizationId,
    channel: "RETAIL",
    limit: 500,
  });
  if (found.source !== "finance") return 0;
  let updated = 0;
  for (const item of found.items) {
    const price = item.unitPrice;
    if (price == null || !Number.isFinite(price)) continue;
    const product = await prisma.productCache.findFirst({
      where: { sku: item.sku },
      select: { id: true, unitPrice: true, organizationId: true },
    });
    if (!product || Number(product.unitPrice) === price) continue;
    const unitPrice = new Prisma.Decimal(price);
    await prisma.productCache.update({
      where: { id: product.id },
      data: { unitPrice },
    });
    await prisma.productPrice.create({
      data: { organizationId: product.organizationId, productId: product.id, unitPrice },
    });
    updated += 1;
  }
  return updated;
}
