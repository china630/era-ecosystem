/** Lifted from era-hotel-pms/nest/generated/agency_ledger.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { serialize } from '@/lib/serialize';
import { requireAgencyPortalSession } from '@/lib/auth/agency-session';
import { getAgencyLedger } from '@/lib/services/agency-ledger.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Agency portal City Ledger statement (read-only).
 * Scoped to session.agencyId — never accepts party id from query.
 */


@Controller()
export class AgencyLedgerController {
  @Get("api/agency/ledger")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const session = await requireAgencyPortalSession();
    const url = requestUrl;
    const fromStr = url.searchParams.get('from') ?? todayBakuYmd();
    const toStr = url.searchParams.get('to') ?? fromStr;
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    const ledger = await getAgencyLedger(session.agencyId, from, to);
    return sendJson(httpRes, 
      serialize({
        agencyId: session.agencyId,
        agencyCode: session.agencyCode,
        from: fromStr,
        to: toStr,
        opening: ledger.opening,
        newCharges: ledger.newCharges,
        payments: ledger.payments,
        cashPaid: ledger.cashPaid,
        netAmount: ledger.netAmount,
        cityLedger: ledger.cityLedger,
        closing: ledger.closing,
        statementBalance: ledger.statementBalance,
        reservationCount: ledger.reservationCount,
        folioCount: ledger.folioCount,
        lines: ledger.lines,
      }),
    );
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
