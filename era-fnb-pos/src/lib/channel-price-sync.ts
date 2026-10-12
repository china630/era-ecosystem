import { searchFinanceCatalog } from "@era/satellite-kit";
import { recordMenuItemPrice } from "@/lib/menu-price-history";
import { prisma } from "@/lib/prisma";

/** Pull FNB channel prices when a shift opens. Open tickets keep their line price. */
export async function syncFnbChannelPrices(organizationId: string): Promise<number> {
  const found = await searchFinanceCatalog({
    organizationId,
    channel: "FNB",
    limit: 500,
  });
  if (found.source !== "finance") return 0;
  let updated = 0;
  for (const item of found.items) {
    const price = item.unitPrice;
    if (price == null || !Number.isFinite(price)) continue;
    const dish = await prisma.menuItem.findFirst({
      where: { financeSku: item.sku },
      select: { id: true, priceAzn: true },
    });
    if (!dish || Number(dish.priceAzn) === price) continue;
    await prisma.menuItem.update({
      where: { id: dish.id },
      data: { priceAzn: price },
    });
    await recordMenuItemPrice(prisma, dish.id, price, { reason: "finance-channel" });
    updated += 1;
  }
  return updated;
}
