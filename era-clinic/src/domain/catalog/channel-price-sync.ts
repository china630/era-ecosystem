import { searchFinanceCatalog } from "@era/satellite-kit";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { prisma } from "@/lib/prisma";

/** Pull CLINIC channel prices at reception day start. Sold orders stay unchanged. */
export async function syncClinicChannelPrices(organizationId: string): Promise<number> {
  const found = await searchFinanceCatalog({
    organizationId,
    channel: "CLINIC",
    limit: 500,
  });
  if (found.source !== "finance") return 0;
  let updated = 0;
  for (const item of found.items) {
    const price = item.unitPrice;
    if (price == null || !Number.isFinite(price)) continue;
    const procedure = await prisma.procedureType.findFirst({
      where: { financeSku: item.sku },
      select: { id: true, code: true },
    });
    if (!procedure) continue;
    const catalog = await prisma.serviceCatalogCache.findUnique({
      where: {
        organizationId_code: { organizationId, code: procedure.code },
      },
      select: { id: true, amount: true },
    });
    if (catalog && Number(catalog.amount) !== price) {
      await prisma.serviceCatalogCache.update({
        where: { id: catalog.id },
        data: { amount: price, listAmount: price },
      });
      await recordCatalogPriceIfChanged({
        organizationId,
        code: procedure.code,
        amount: price,
        listAmount: price,
      });
      updated += 1;
      continue;
    }
    const last = await prisma.procedureTypePrice.findFirst({
      where: { procedureTypeId: procedure.id },
      orderBy: { effectiveFrom: "desc" },
    });
    if (last && Number(last.amount) === price) continue;
    await prisma.procedureTypePrice.create({
      data: {
        organizationId,
        procedureTypeId: procedure.id,
        amount: price,
      },
    });
    updated += 1;
  }
  return updated;
}
