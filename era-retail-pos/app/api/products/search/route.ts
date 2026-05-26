import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { ensureProductCacheSeeded } from "@/lib/product-cache-seed";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await ensureProductCacheSeeded();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
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
