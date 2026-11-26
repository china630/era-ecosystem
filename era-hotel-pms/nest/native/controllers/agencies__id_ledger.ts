/** Lifted from era-hotel-pms/nest/generated/agencies__id_ledger.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { serialize } from '@/lib/serialize';
import { getAgencyLedger } from '@/lib/services/agency-ledger.service';
import { dispatchCityLedgerSnapshot } from '@/lib/integration/event-dispatcher';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AgenciesIdLedgerController {
  @Get("api/agencies/:id/ledger")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const { id } = httpReq.params;
    const url = requestUrl;
    const fromStr = url.searchParams.get('from') ?? todayBakuYmd();
    const toStr = url.searchParams.get('to') ?? fromStr;
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    const ledger = await getAgencyLedger(id, from, to);
    if (url.searchParams.get('dispatch') === 'true') {
      void dispatchCityLedgerSnapshot(id, toStr).catch(console.error);
    }
    return sendJson(httpRes, serialize(ledger));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
