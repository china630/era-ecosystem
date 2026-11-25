/** Lifted from nest/generated/public_menu__slug.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { findActiveOutletByPublicSlug, isOutletPoolUnavailable, listActiveMenuCategoriesForOutlet, listSoldOutMenuItemIdsForOutlet } from "@/lib/public-outlet.service";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { assertPublicMenuQuota } from "@/lib/fnb-quota";
import { enterRequestTenant } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PublicMenuSlugController {
  @Get("api/public/menu/:slug")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  
    const ip =
      nestHeader(httpReq, "x-forwarded-for")?.split(",")[0]?.trim() ||
      nestHeader(httpReq, "x-real-ip") ||
      "unknown";
    assertPublicMenuQuota(ip);
    const { slug } = httpReq.params;
    let outlet: Awaited<ReturnType<typeof findActiveOutletByPublicSlug>>;
    try {
      outlet = await findActiveOutletByPublicSlug(slug);
    } catch (err) {
      if (isOutletPoolUnavailable(err)) {
        return sendJson(httpRes, { error: "Organization registry unavailable" }, 503);
      }
      throw err;
    }
    if (!outlet) return sendJson(httpRes, { error: "Menu not found" }, 404);
    enterRequestTenant(outlet.organizationId);
    await requireFnbSubmodule("fnb_qr_menu", outlet.organizationId);

    const sold = await listSoldOutMenuItemIdsForOutlet(outlet.organizationId, outlet.id);
    const soldIds = new Set(sold.map((s) => s.menuItemId));

    const categories = await listActiveMenuCategoriesForOutlet(outlet.id);

    return sendJson(httpRes, {
      outlet: { name: outlet.name, code: outlet.code },
      orderEnabled: false,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items
          .filter((i) => !soldIds.has(i.id))
          .map((i) => ({
            id: i.id,
            name: i.name,
            priceAzn: i.priceAzn,
            imageUrl: i.imageUrl,
          })),
      })),
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/public/menu/:slug")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  return sendJson(httpRes, 
    { error: "Guest ordering is not enabled on QR menu", code: "QR_READ_ONLY" }, 405);

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
