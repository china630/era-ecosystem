/** Lifted from era-hotel-pms/nest/generated/reports_room-changes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createRoomChangePlan, listRoomChangePlans } from '@/lib/services/reports.service';
import { requestRoomMove } from '@/lib/services/room-move-request.service';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  reservationId: z.string().uuid(),
  fromRoomId: z.string().uuid().optional(),
  toRoomId: z.string().uuid().optional(),
  effectiveAt: z.coerce.date(),
  notes: z.string().optional(),
});


@Controller()
export class ReportsRoomChangesController {
  @Get("api/reports/room-changes")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    return sendJson(httpRes, serialize(await listRoomChangePlans()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/reports/room-changes")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(httpReq.body);
    if (body.toRoomId) {
      return sendJson(httpRes, 
        await requestRoomMove(body.reservationId, body.toRoomId, {
          effectiveDate: hotelDateKey(body.effectiveAt),
          actorUserId: session?.sub,
          request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
        }),
      );
    }
    return sendJson(httpRes, 
      serialize(await createRoomChangePlan({ ...body, createdByUserId: session?.sub })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
