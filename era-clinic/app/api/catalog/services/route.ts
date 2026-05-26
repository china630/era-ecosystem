import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { ensureServiceCatalogSeeded } from "@/lib/service-catalog-seed";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await ensureServiceCatalogSeeded();
    const services = await prisma.serviceCatalogCache.findMany({
      orderBy: { code: "asc" },
    });
    return jsonOk(services);
  } catch (err) {
    return handleRouteError(err);
  }
}
