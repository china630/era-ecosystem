/** Lifted from era-hotel-pms/nest/generated/front-cash_transactions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listFrontCashJournal } from '@/lib/services/front-cash-transactions.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function dayStart(iso: string) {
  return bakuCivilUtcDate(iso);
}


@Controller()
export class FrontCashTransactionsController {
  @Get("api/front-cash/transactions")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = requestUrl;
    const today = hotelDateKey(await getCurrentBusinessDate());
    const from = dayStart(url.searchParams.get('from') ?? today);
    const to = dayStart(url.searchParams.get('to') ?? today);
    const cashShiftId = url.searchParams.get('cashShiftId') ?? undefined;
    return sendJson(httpRes, serialize(await listFrontCashJournal({ from, to, cashShiftId })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
