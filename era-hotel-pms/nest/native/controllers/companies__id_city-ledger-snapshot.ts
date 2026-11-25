/** Lifted from era-hotel-pms/nest/generated/companies__id_city-ledger-snapshot.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { dispatchCompanyCityLedgerSnapshot } from '@/lib/integration/event-dispatcher';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { getLastCityLedgerSnapshotAudit } from '@/lib/services/city-ledger-gate.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const postSchema = z.object({
  asOfDate: z.string().min(8).optional(),
});


@Controller()
export class CompaniesIdCityLedgerSnapshotController {
  @Get("api/companies/:id/city-ledger-snapshot")
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
      companyId: id,
      lastSnapshot: last
        ? {
            at: last.createdAt,
            action: last.action,
            changes: last.changesJson ? JSON.parse(last.changesJson) : null,
          }
        : null,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/companies/:id/city-ledger-snapshot")
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
    const result = await dispatchCompanyCityLedgerSnapshot(id, asOfDate);
    await recordHotelAudit({ userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } }, 'CityLedgerSnapshot', id, 'PUSH', {
      asOfDate,
      party: 'COMPANY',
      result,
    });
    return sendJson(httpRes, { ok: true, asOfDate, result });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
