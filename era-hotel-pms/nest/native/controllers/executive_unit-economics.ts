/** Lifted from era-hotel-pms/nest/generated/executive_unit-economics.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getUnitEconomicsSnapshot } from '@/lib/services/unit-economics.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ExecutiveUnitEconomicsController {
  @Get("api/executive/unit-economics")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    return sendJson(httpRes, await getUnitEconomicsSnapshot());
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
