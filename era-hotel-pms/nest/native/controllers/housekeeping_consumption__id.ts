/** Lifted from era-hotel-pms/nest/generated/housekeeping_consumption__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { deleteHkConsumption } from '@/lib/services/hk-consumption.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HousekeepingConsumptionIdController {
  @Delete("api/housekeeping/consumption/:id")
  @HttpCode(200)
  async delete_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const { id } = httpReq.params;
    await deleteHkConsumption(id);
    return sendJson(httpRes, { ok: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
