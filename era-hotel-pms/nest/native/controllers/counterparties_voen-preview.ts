/** Lifted from era-hotel-pms/nest/generated/counterparties_voen-preview.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { fetchVoenPreviewFromRequest } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class CounterpartiesVoenPreviewController {
  @Get("api/counterparties/voen-preview")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const result = await fetchVoenPreviewFromRequest(req);
    return sendJson(httpRes, result);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
