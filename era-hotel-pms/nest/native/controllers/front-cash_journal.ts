/** Lifted from era-hotel-pms/nest/generated/front-cash_journal.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { listCashJournal } from '@/lib/services/cash-desk.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class FrontCashJournalController {
  @Get("api/front-cash/journal")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = requestUrl;
    const date =
      url.searchParams.get('date') ||
      url.searchParams.get('from') ||
      hotelDateKey(await getCurrentBusinessDate());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return sendJson(httpRes, { error: 'Invalid date' }, 400);
    }
    const lines = await listCashJournal({
      businessDate: date,
      cashPoint: url.searchParams.get('cashPoint'),
      tender: url.searchParams.get('tender'),
    });
    return sendJson(httpRes, serialize({ date, lines }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
