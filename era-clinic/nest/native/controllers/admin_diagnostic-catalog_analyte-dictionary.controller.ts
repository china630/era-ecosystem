import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { searchAnalyteDictionary } from "@/domain/catalog/diagnostic-catalog-admin.service";

@Controller()
export class AdminDiagnosticCatalogAnalyteDictionaryController {

  @Get("api/admin/diagnostic-catalog/analyte-dictionary")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "30");
    const rows = await searchAnalyteDictionary(q, Number.isFinite(limit) ? limit : 30);
    return {
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
    };
  
        });
  }
}
