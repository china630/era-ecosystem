/** Lifted from era-hotel-pms/nest/generated/housekeeping_finance-products.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { searchFinanceCatalog } from "@era/satellite-kit";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Finance sku picker. Minibar stays goods-only.
 * Consumption passes includeServices=1 so a service sku with a recipe can be the norm.
 */


@Controller()
export class HousekeepingFinanceProductsController {
  @Get("api/housekeeping/finance-products")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const url = requestUrl;
    const q = (url.searchParams.get("q") ?? "").trim();
    const includeServices = url.searchParams.get("includeServices") === "1";
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 30;
    const result = await searchFinanceCatalog({
      organizationId: requestOrganizationId(),
      search: q,
      isService: includeServices ? undefined : false,
      limit,
      channel: "HOTEL",
    });
    return sendJson(httpRes, {
      items: result.items.map((p) => ({
        value: p.sku,
        label: `${p.sku} — ${p.name}`,
        sku: p.sku,
        revenueAccountCode: p.revenueAccountCode,
      })),
      source: result.source,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
