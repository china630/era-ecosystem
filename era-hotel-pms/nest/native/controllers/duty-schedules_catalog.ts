/** Lifted from era-hotel-pms/nest/generated/duty-schedules_catalog.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listCatalog } from "@/lib/duty-schedules/duty-schedule.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class DutySchedulesCatalogController {
  @Get("api/duty-schedules/catalog")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.DUTY_SCHEDULES_MANAGE);
    return sendJson(httpRes, await listCatalog());
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
