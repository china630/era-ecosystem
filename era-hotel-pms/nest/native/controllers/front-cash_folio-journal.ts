/** Lifted from era-hotel-pms/nest/generated/front-cash_folio-journal.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { queryFolioTransactions } from '@/lib/services/reports/folio-transactions.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class FrontCashFolioJournalController {
  @Get("api/front-cash/folio-journal")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = requestUrl;
    const today = hotelDateKey(await getCurrentBusinessDate());
    const from = url.searchParams.get('from') ?? today;
    const to = url.searchParams.get('to') ?? from;
    return sendJson(httpRes, serialize(await queryFolioTransactions(from, to)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
