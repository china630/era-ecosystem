import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { parseCatalogKindQuery } from "@/domain/catalog/service-catalog-kind";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const kinds = parseCatalogKindQuery(url.searchParams.get("kind"));
    const missingListPrice = url.searchParams.get("missingListPrice") === "1";

    const where: Prisma.ServiceCatalogCacheWhereInput = {};
    if (kinds) where.kind = { in: kinds };
    if (missingListPrice) {
      // Package-included or commercial amount 0, and no usable listAmount.
      where.AND = [
        {
          OR: [{ packageIncluded: true }, { amount: 0 }],
        },
        {
          OR: [{ listAmount: null }, { listAmount: 0 }],
        },
      ];
    }

    const rows = await prisma.serviceCatalogCache.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { code: "asc" },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
