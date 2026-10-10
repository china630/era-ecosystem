import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { searchAnalyteDictionary } from "@/domain/catalog/diagnostic-catalog-admin.service";

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "30");
    const rows = await searchAnalyteDictionary(q, Number.isFinite(limit) ? limit : 30);
    return jsonOk({
      items: rows.map((row) => ({
        code: row.code,
        unit: row.unit,
        labelEn: row.labelEn,
        labelRu: row.labelRu,
        labelAz: row.labelAz,
        refMin: row.refMin,
        refMax: row.refMax,
        section: row.section,
        valueType: row.valueType,
        optionsJson: row.optionsJson,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
