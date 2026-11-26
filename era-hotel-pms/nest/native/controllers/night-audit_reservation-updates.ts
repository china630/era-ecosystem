/** Lifted from era-hotel-pms/nest/generated/night-audit_reservation-updates.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { bakuDayBounds, todayBakuYmd } from '@era/satellite-kit/time';
import { listNightAuditReservationUpdates, reservationUpdatesToCsv, type UpdateActionKind } from '@/lib/services/night-audit-updates.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const actionSchema = z.enum(['ALL', 'CANCEL', 'EXTEND', 'NOTE', 'OTHER']);


@Controller()
export class NightAuditReservationUpdatesController {
  @Get("api/night-audit/reservation-updates")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = requestUrl;
    const today = todayBakuYmd();
    const from = bakuDayBounds(url.searchParams.get('from') ?? today).start;
    const to = bakuDayBounds(url.searchParams.get('to') ?? today).start;
    const action = actionSchema.parse(url.searchParams.get('action') ?? 'ALL') as UpdateActionKind;
    const rows = await listNightAuditReservationUpdates({ from, to, action });
    if (url.searchParams.get('format') === 'csv') {
      const csv = reservationUpdatesToCsv(rows);
      httpRes.setHeader("Content-Type", "text/csv; charset=utf-8");
      httpRes.setHeader(
        "Content-Disposition",
        `attachment; filename="reservation-updates-${url.searchParams.get("from") ?? today}.csv"`,
      );
      httpRes.status(200).send(csv);
      return;
    }
    return sendJson(httpRes, serialize(rows));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
