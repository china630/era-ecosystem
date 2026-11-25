/** Lifted from era-hotel-pms/nest/generated/housekeeping_consumption__id_reverse.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { reverseHkConsumption } from '@/lib/services/hk-consumption.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HousekeepingConsumptionIdReverseController {
  @Post("api/housekeeping/consumption/:id/reverse")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const { id } = httpReq.params;
    const saved = await reverseHkConsumption(id);
    return sendJson(httpRes, serialize(saved), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
