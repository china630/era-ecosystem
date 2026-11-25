/** Lifted from era-hotel-pms/nest/generated/reservations__id_missed-nights.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listMissedRoomNights, postMissedRoomNights } from '@/lib/services/missed-room-nights.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdMissedNightsController {
  @Get("api/reservations/:id/missed-nights")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [PERMISSIONS.FOLIO_CHARGE, PERMISSIONS.NIGHT_AUDIT_RUN]);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listMissedRoomNights(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/reservations/:id/missed-nights")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [PERMISSIONS.FOLIO_CHARGE, PERMISSIONS.NIGHT_AUDIT_RUN]);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await postMissedRoomNights(id, session?.sub)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
