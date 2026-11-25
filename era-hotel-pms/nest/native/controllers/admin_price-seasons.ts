/** Lifted from era-hotel-pms/nest/generated/admin_price-seasons.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from "@/lib/serialize";
import { assertMasterDataRead } from "@/lib/auth/master-data-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listPriceSeasons } from "@/lib/services/price-season.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminPriceSeasonsController {
  @Get("api/admin/price-seasons")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.SEASONS_ADMIN);
    return sendJson(httpRes, serialize(await listPriceSeasons()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
