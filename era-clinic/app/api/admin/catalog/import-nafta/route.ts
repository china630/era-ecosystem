import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { importNaftaPricesFromFile } from "@/domain/catalog/nafta-prices-import.service";

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;

    const result = await importNaftaPricesFromFile();
    if (result.skipped) {
      return jsonOk({ skipped: true, message: result.message });
    }

    return jsonOk({
      skipped: false,
      catalogCount: result.catalogCount,
      typeCount: result.typeCount,
      source: result.source,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
