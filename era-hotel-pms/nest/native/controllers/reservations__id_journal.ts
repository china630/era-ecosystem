/** Lifted from era-hotel-pms/nest/generated/reservations__id_journal.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationJournal } from '@/lib/reservation-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdJournalController {
  @Get("api/reservations/:id/journal")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = httpReq.params;
    const url = requestUrl;
    const includeIp = Boolean(
      session && sessionHasHotelPermission(session, PERMISSIONS.SCREEN_SETTINGS),
    );
    const journal = await listReservationJournal(id, {
      includeIp,
      section: url.searchParams.get('section') ?? undefined,
      source: url.searchParams.get('source') ?? undefined,
    });
    return sendJson(httpRes, journal);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
