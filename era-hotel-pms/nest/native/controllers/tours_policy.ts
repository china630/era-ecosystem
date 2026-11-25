/** Lifted from era-hotel-pms/nest/generated/tours_policy.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getTourOpsPolicy, saveTourOpsPolicy } from '@/lib/services/tour-ops-policy.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  chargeMode: z.enum(['CHARGE_ON_BOARDING', 'CHARGE_ON_ADD']).optional(),
  boardingCloseMode: z.enum(['MANUAL', 'AUTO_CUTOFF']).optional(),
  autoCutoffMinutesBeforePickup: z.number().int().positive().nullable().optional(),
  allowOverbook: z.boolean().optional(),
  dropUnboardedOnClose: z.boolean().optional(),
});


@Controller()
export class ToursPolicyController {
  @Get("api/tours/policy")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    return sendJson(httpRes, serialize(await getTourOpsPolicy(session.organizationId)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/tours/policy")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await saveTourOpsPolicy(body, session.organizationId)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
