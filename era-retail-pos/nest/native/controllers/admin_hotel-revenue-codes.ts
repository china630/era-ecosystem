/** Lifted from nest/generated/admin_hotel-revenue-codes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { HotelRevenueCatalogError, listHotelRevenueCodes } from "@era/satellite-kit";
import { hotelOrganizationId } from "@/lib/pms-bridge-client";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Active hotel revenue codes for outlet, category, and product pickers. */


@Controller()
export class AdminHotelRevenueCodesController {
  @Get("api/admin/hotel-revenue-codes")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  try {
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    let hotelOrg = "";
    try {
      hotelOrg = await hotelOrganizationId();
    } catch {
      return sendJson(httpRes, { error: "Hotel organization is not linked" }, 409);
    }
    const codes = await listHotelRevenueCodes(hotelOrg);
    return sendJson(httpRes, { codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return sendJson(httpRes, { error: err.message }, status);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
