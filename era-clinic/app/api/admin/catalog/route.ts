import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { parseCatalogKindQuery } from "@/domain/catalog/service-catalog-kind";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const kinds = parseCatalogKindQuery(new URL(req.url).searchParams.get("kind"));
    const rows = await prisma.serviceCatalogCache.findMany({
      where: kinds ? { kind: { in: kinds } } : undefined,
      orderBy: { code: "asc" },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
