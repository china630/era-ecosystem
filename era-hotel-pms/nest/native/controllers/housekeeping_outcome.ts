/** Lifted from era-hotel-pms/nest/generated/housekeeping_outcome.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyVisitOutcome, applySheetOutcome, clearSheetOutcome } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  taskId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  date: z.string().optional(),
  outcome: z.enum(['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO']).optional(),
  clear: z.boolean().optional(),
});

function assertSheetDay(date: string) {
  if (date !== todayBakuYmd()) {
    throw new Error('Cannot edit a floor sheet that is not the business date');
  }
}


@Controller()
export class HousekeepingOutcomeController {
  @Post("api/housekeeping/outcome")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(httpReq.body);
    if (body.roomId) {
      const date = body.date ?? todayBakuYmd();
      assertSheetDay(date);
      if (body.clear || !body.outcome) {
        return sendJson(httpRes, serialize(await clearSheetOutcome(body.roomId, date)));
      }
      return sendJson(httpRes, serialize(await applySheetOutcome(body.roomId, date, body.outcome, { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })));
    }
    if (!body.taskId || !body.outcome) throw new Error('taskId or roomId required');
    return sendJson(httpRes, serialize(await applyVisitOutcome(body.taskId, body.outcome, { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
