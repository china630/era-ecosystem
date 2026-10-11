import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { ensureProductCacheSeeded } from "@/lib/product-cache-seed";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { searchFinanceCatalog } from "@era/satellite-kit";

async function refreshProductCacheFromFinance(search: string): Promise<void> {
  const organizationId = requestOrganizationId();
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
    const nextPrice = item.unitPrice != null ? item.unitPrice : existing ? Number(existing.unitPrice) : 0;
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

export async function GET(req: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    try {
      await refreshProductCacheFromFinance(q);
    } catch {
      // Finance catalog unavailable: keep the local cache.
    }
    await ensureProductCacheSeeded();
    if (!q) {
      const all = await prisma.productCache.findMany({ take: 20, orderBy: { sku: "asc" } });
      return jsonOk(all);
    }

    const products = await prisma.productCache.findMany({
      where: {
        OR: [
          { sku: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
    });
    return jsonOk(products);
  } catch (err) {
    return handleRouteError(err);
  }
}
