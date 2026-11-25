/** Lifted from era-hotel-pms/nest/generated/agencies__id_city-ledger-snapshot.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { dispatchCityLedgerSnapshot } from '@/lib/integration/event-dispatcher';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { getLastCityLedgerSnapshotAudit } from '@/lib/services/city-ledger-gate.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const postSchema = z.object({
  asOfDate: z.string().min(8).optional(),
});


@Controller()
export class AgenciesIdCityLedgerSnapshotController {
  @Get("api/agencies/:id/city-ledger-snapshot")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = httpReq.params;
    const last = await getLastCityLedgerSnapshotAudit(id);
    return sendJson(httpRes, {
      agencyId: id,
      lastSnapshot: last
        ? {
            at: last.createdAt,
            action: last.action,
            changes: last.changesJson ? JSON.parse(last.changesJson) : null,
          }
        : null,
      financeSalesInvoicesUrl: process.env.NEXT_PUBLIC_FINANCE_WEB_URL
        ? `${process.env.NEXT_PUBLIC_FINANCE_WEB_URL.replace(/\/$/, '')}/sales/invoices`
        : null,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/agencies/:id/city-ledger-snapshot")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = postSchema.parse((httpReq.body ?? {}));
    const asOfDate = body.asOfDate ?? todayBakuYmd();
    const result = await dispatchCityLedgerSnapshot(id, asOfDate);
    await recordHotelAudit(
      { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      'CityLedgerSnapshot',
      id,
      'PUSH',
      { asOfDate, result },
    );
    return sendJson(httpRes, { ok: true, asOfDate, result });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
