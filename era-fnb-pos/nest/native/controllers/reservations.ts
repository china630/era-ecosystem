/** Lifted from nest/generated/reservations.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { z } from "zod";
import { createTableReservation, listTableReservationsForDay } from "@/lib/fnb-reservation.service";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { HOTEL_READ_RESERVATIONS } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  tableId: z.string(),
  startAt: z.string().datetime({ offset: true }).or(z.string()),
  endAt: z.string(),
  guestName: z.string().optional(),
  partySize: z.number().int().positive().optional(),
});


@Controller()
export class ReservationsController {
  @Get("api/reservations")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, HOTEL_READ_RESERVATIONS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await assertHotelFnbFeature("reservations");
    const dateYmd = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString()).searchParams.get("date") ?? todayBakuYmd();
    const { start: dayStart, end: dayEnd } = bakuDayBounds(dateYmd);

    const rows = await listTableReservationsForDay(dayStart, dayEnd);
    return sendJson(httpRes, rows);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/reservations")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(
      session,
      PERMISSIONS.RESERVATIONS_OPEN_TICKET,
    );
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await assertHotelFnbFeature("reservations");
    const body = createSchema.parse(httpReq.body);
    const row = await createTableReservation({
      tableId: body.tableId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      guestName: body.guestName,
      partySize: body.partySize ?? 2,
    });
    return sendJson(httpRes, row, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
