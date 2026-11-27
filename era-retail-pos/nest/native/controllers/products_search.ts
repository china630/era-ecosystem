/** Lifted from nest/generated/products_search.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ensureProductCacheSeeded } from "@/lib/product-cache-seed";
import { requestOrganizationId } from "@/lib/request-organization";
import { listProductCacheDefault, refreshProductCacheFromFinance, searchProductCache } from "@/lib/product.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ProductsSearchController {
  @Get("api/products/search")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const url = requestUrl;
    const q = (url.searchParams.get("q") ?? "").trim();
    try {
      await refreshProductCacheFromFinance(requestOrganizationId(), q);
    } catch {
      // Finance catalog unavailable: keep the local cache.
    }
    await ensureProductCacheSeeded();
    if (!q) {
      const all = await listProductCacheDefault();
      return sendJson(httpRes, all);
    }

    const products = await searchProductCache(q);
    return sendJson(httpRes, products);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
