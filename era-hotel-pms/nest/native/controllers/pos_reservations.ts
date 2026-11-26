/** Lifted from era-hotel-pms/nest/generated/pos_reservations.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuDayBounds, todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createPosReservation, listPosReservations } from '@/lib/services/pos.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** @deprecated Table reservations UI lives in era-fnb-pos. */








const schema = z.object({
  resourceId: z.string().uuid(),
  startAt: z.string(),
  endAt: z.string(),
  partySize: z.number().int().optional(),
  reservationId: z.string().uuid().optional(),
  guestName: z.string().optional(),
  notes: z.string().optional(),
});


@Controller()
export class PosReservationsController {
  @Get("api/pos/reservations")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.POS_READ);
    const url = requestUrl;
    const dateStr = url.searchParams.get('date') ?? todayBakuYmd();
    const { start, end } = bakuDayBounds(dateStr);
    return sendJson(httpRes, serialize(await listPosReservations(start, end)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/pos/reservations")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.POS_WRITE);
    const body = schema.parse(httpReq.body);
    const row = await createPosReservation({
      resourceId: body.resourceId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      partySize: body.partySize,
      reservationId: body.reservationId,
      guestName: body.guestName,
      notes: body.notes,
    });
    return sendJson(httpRes, serialize(row), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
