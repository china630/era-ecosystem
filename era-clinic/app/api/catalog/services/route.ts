import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { ensureServiceCatalogSeeded } from "@/lib/service-catalog-seed";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return denied;

    await ensureServiceCatalogSeeded();
    const services = await prisma.serviceCatalogCache.findMany({
      orderBy: { code: "asc" },
    });
    return jsonOk(services);
  } catch (err) {
    return handleRouteError(err);
  }
}
