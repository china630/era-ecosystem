/** Lifted from era-hotel-pms/nest/generated/housekeeping_personnel.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { fetchWorkforcePicker } from "@/lib/duty-schedules/picker";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HousekeepingPersonnelController {
  @Get("api/housekeeping/personnel")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const orgId = requestOrganizationId();
    const picker = await fetchWorkforcePicker(orgId);
    const items = picker.items.map((item) => ({
      id: item.id,
      globalPersonId: item.globalPersonId,
      name: item.name,
      orgUnitId: item.orgUnitId,
      orgUnitName: item.orgUnitName,
      positionId: item.positionId,
      positionName: item.positionName,
    }));
    return sendJson(httpRes, { items, unavailable: picker.unavailable });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
