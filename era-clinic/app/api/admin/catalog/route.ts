import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const rows = await prisma.serviceCatalogCache.findMany({ orderBy: { code: "asc" } });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
