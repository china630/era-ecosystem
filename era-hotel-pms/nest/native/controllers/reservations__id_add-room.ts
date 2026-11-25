/** Lifted from era-hotel-pms/nest/generated/reservations__id_add-room.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { addRoomStayFromReservation } from '@/lib/services/booking-stays.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ id: string }> };

/** POST — ensure Booking group, then clone a sibling RoomStay. */


@Controller()
export class ReservationsIdAddRoomController {
  @Post("api/reservations/:id/add-room")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    z.string().uuid().parse(id);
    const stay = await addRoomStayFromReservation(id, {
      userId: session?.sub,
      request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    });
    return sendJson(httpRes, serialize(stay), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
