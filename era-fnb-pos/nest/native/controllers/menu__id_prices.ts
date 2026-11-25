/** Lifted from nest/generated/menu__id_prices.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { findMenuItemById, listMenuItemPriceHistory } from "@/lib/menu.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class MenuIdPricesController {
  @Get("api/menu/:id/prices")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const item = await findMenuItemById(id);
    if (!item) return sendJson(httpRes, { error: "Menu item not found" }, 404);

    const prices = await listMenuItemPriceHistory(id);
    return sendJson(httpRes, {
      menuItemId: id,
      plu: item.plu,
      name: item.name,
      currentPriceAzn: item.priceAzn,
      prices,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
