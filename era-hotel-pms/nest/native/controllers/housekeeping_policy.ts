/** Lifted from era-hotel-pms/nest/generated/housekeeping_policy.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getHkHotelPolicy, saveHkHotelPolicy } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  linenEveryNights: z.number().int().min(1).max(30),
  deepEveryNights: z.number().int().min(1).max(30),
  laundryExpressEnabled: z.boolean().optional(),
  laundryIntakeMode: z.enum(['ANY', 'WINDOW']).optional(),
  laundryIntakeStartHour: z.number().int().min(0).max(23).nullable().optional(),
  laundryIntakeEndHour: z.number().int().min(0).max(23).nullable().optional(),
  laundryClosedDays: z
    .enum(['ALL', 'EXCEPT_SUNDAY', 'EXCEPT_CALENDAR', 'EXCEPT_SUNDAY_AND_CALENDAR'])
    .optional(),
  laundryDueMode: z.enum(['NONE', 'BY_HOUR']).optional(),
  laundryDueCutoffHour: z.number().int().min(0).max(23).nullable().optional(),
  laundryDueAtHour: z.number().int().min(0).max(23).nullable().optional(),
  egPressureFrom: z.string().nullable().optional(),
});


@Controller()
export class HousekeepingPolicyController {
  @Get("api/housekeeping/policy")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return sendJson(httpRes, serialize(await getHkHotelPolicy()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/housekeeping/policy")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(httpReq.body);
    if (body.laundryIntakeMode === 'WINDOW') {
      if (body.laundryIntakeStartHour == null || body.laundryIntakeEndHour == null) {
        return sendJson(httpRes, 
          { error: 'Intake window requires start and end hour' }, 400);
      }
      if (body.laundryIntakeStartHour >= body.laundryIntakeEndHour) {
        return sendJson(httpRes, { error: 'Intake start must be before end' }, 400);
      }
    }
    return sendJson(httpRes, 
      serialize(
        await saveHkHotelPolicy(body.linenEveryNights, body.deepEveryNights, {
          laundryExpressEnabled: body.laundryExpressEnabled,
          laundryIntakeMode: body.laundryIntakeMode,
          laundryIntakeStartHour: body.laundryIntakeStartHour,
          laundryIntakeEndHour: body.laundryIntakeEndHour,
          laundryClosedDays: body.laundryClosedDays,
          laundryDueMode: body.laundryDueMode,
          laundryDueCutoffHour: body.laundryDueCutoffHour,
          laundryDueAtHour: body.laundryDueAtHour,
          egPressureFrom: body.egPressureFrom,
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
