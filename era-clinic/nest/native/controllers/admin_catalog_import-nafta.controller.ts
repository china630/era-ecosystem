import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { importNaftaPricesFromFile } from "@/domain/catalog/nafta-prices-import.service";

@Controller()
export class AdminCatalogImportNaftaController {

  @Post("api/admin/catalog/import-nafta")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);

    const result = await importNaftaPricesFromFile();
    if (result.skipped) {
      return { skipped: true, message: result.message };
    }

    return {
      skipped: false,
      catalogCount: result.catalogCount,
      typeCount: result.typeCount,
      source: result.source,
    };
  
        });
  }
}
