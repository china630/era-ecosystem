/** Lifted from era-hotel-pms/nest/generated/reports_reservations-grid.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationsForGrid } from '@/lib/services/reservation-full.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsReservationsGridController {
  @Get("api/reports/reservations-grid")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const params = requestUrl.searchParams;
    const hasNotesRaw = params.get('hasNotes');
    const result = await listReservationsForGrid({
      guestId: params.get('guestId') ?? undefined,
      q: params.get('q') ?? undefined,
      noteQ: params.get('noteQ') ?? undefined,
      status: params.get('status') ?? undefined,
      hasNotes: hasNotesRaw === '1' || hasNotesRaw === 'true',
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
      dateFrom: params.get('dateFrom') ?? undefined,
      dateTo: params.get('dateTo') ?? undefined,
      queue: params.get('queue') ?? undefined,
      overdue: params.get('overdue') === '1',
      sort: params.get('sort') ?? undefined,
      dir: params.get('dir') === 'desc' ? 'desc' : params.get('dir') === 'asc' ? 'asc' : undefined,
    });
    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
