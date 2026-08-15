import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { importNaftaPricesFromFile } from "@/domain/catalog/nafta-prices-import.service";

export async function POST() {
  try {
    const guard = await assertClinicAdminWrite();
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
