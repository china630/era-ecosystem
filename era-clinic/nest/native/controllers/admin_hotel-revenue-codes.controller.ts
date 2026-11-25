import { Controller, Get, HttpCode, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";
import { HotelRevenueCatalogError, listHotelRevenueCodes } from "@era/satellite-kit";


/** Active hotel revenue codes for the department catalog picker. */

@Controller()
export class AdminHotelRevenueCodesController {

  @Get("api/admin/hotel-revenue-codes")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const hotelOrg = await getClinicHotelOrganizationId();
    if (!hotelOrg) {
      throw new HttpException({ error: "Hotel organization is not linked", ...{ code: "HOTEL_NOT_LINKED" } }, 409);
    }
    const codes = await listHotelRevenueCodes(hotelOrg);
    return { codes };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof HotelRevenueCatalogError) {
      const status = err.code === "HOTEL_NOT_LINKED" ? 409 : 502;
      throw new HttpException({ error: err.message, ...{ code: err.code } }, status);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
