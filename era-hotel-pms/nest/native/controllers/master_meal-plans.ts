/** Lifted from era-hotel-pms/nest/generated/master_meal-plans.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requestOrganizationId } from '@/lib/request-organization';
import { listMealPlans, listMealPlansForBoard } from '@/lib/services/master-data.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class MasterMealPlansController {
  @Get("api/master/meal-plans")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MEAL_PLANS_READ);
    let rows;
    try {
      rows = await listMealPlansForBoard(requestOrganizationId());
    } catch {
      rows = await listMealPlans();
    }
    return sendJson(httpRes, serialize(rows));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
