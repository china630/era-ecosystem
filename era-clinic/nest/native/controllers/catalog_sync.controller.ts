import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { pushClinicSkusToFinance, fetchFinanceServiceCatalog, upsertServiceCatalogFinanceRows } from "@/lib/services/clinic-master-data.service";
import { requestOrganizationId } from "@/lib/request-organization";

@Controller()
export class CatalogSyncController {

  @Post("api/catalog/sync")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const organizationId = requestOrganizationId();
    const pushed = await pushClinicSkusToFinance(organizationId);
    const items = await fetchFinanceServiceCatalog(organizationId);
    if (items.length === 0) {
      return { synced: 0, pushed, source: "unavailable" };
    }

    await upsertServiceCatalogFinanceRows(organizationId, items);
    for (const item of items) {
      const listAmount = item.amount > 0 ? item.amount : null;
      await recordCatalogPriceIfChanged({
        organizationId,
        code: item.code,
        amount: item.amount,
        listAmount,
      });
    }

    return { synced: items.length, pushed, source: "finance" };
  
        });
  }
}
