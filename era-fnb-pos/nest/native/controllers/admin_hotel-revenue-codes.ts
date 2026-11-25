/** Lifted from nest/generated/admin_hotel-revenue-codes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { HotelRevenueCatalogError, listHotelRevenueCodes, resolveCatalogOrganizationId } from "@era/satellite-kit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Hotel revenue keys for the dish picker. A department reads the hotel list. */


@Controller()
export class AdminHotelRevenueCodesController {
  @Get("api/admin/hotel-revenue-codes")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.HOTEL_REVENUE_CODES);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const hubOrg = await resolveCatalogOrganizationId(requestOrganizationId());
    if (!hubOrg) {
      return sendJson(httpRes, 
        { error: "Hotel organization is not linked", code: "HOTEL_NOT_LINKED" }, 409);
    }
    const codes = await listHotelRevenueCodes(hubOrg);
    return sendJson(httpRes, { codes });
  } catch (err) {
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      return sendJson(httpRes, { error: err.message, code: err.code }, ( { status }).status ?? 200);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
