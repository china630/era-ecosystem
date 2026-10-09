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
  });
  if (result.source !== "finance" || result.items.length === 0) return;
  for (const item of result.items) {
    await prisma.productCache.upsert({
      where: { organizationId_sku: { organizationId, sku: item.sku } },
      create: {
        organizationId,
        sku: item.sku,
        description: item.name,
        unitPrice: 0,
        revenueAccountCode: item.revenueAccountCode,
      },
      update: {
        description: item.name,
        revenueAccountCode: item.revenueAccountCode,
        syncedAt: new Date(),
      },
    });
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
