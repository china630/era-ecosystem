/** Lifted from era-hotel-pms/nest/generated/folios__id_retry-cl-invoice.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { handoffPendingCityLedger } from '@/lib/services/city-ledger-night-handoff.service';
import { getFolioCityLedgerRetryMeta } from '@/lib/services/folio.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Same rule as night audit: transfer this PENDING_AR folio only when Finance already has the VÖEN card.
 */


@Controller()
export class FoliosIdRetryClInvoiceController {
  @Post("api/folios/:id/retry-cl-invoice")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const folio = await getFolioCityLedgerRetryMeta(id);
    if (!folio) {
      return sendJson(httpRes, { error: 'Folio not found', code: 'NOT_FOUND' }, 404);
    }
    if (folio.type !== 'AGENCY' && folio.type !== 'COMPANY') {
      return sendJson(httpRes, 
        { error: 'Only agency or company folios can retry City Ledger invoice', code: 'INVALID_FOLIO' }, 409);
    }
    if (folio.status !== 'PENDING_AR') {
      return sendJson(httpRes, 
        { error: 'Folio is not waiting for the night City Ledger handoff', code: 'INVALID_STATUS' }, 409);
    }

    const lines = await handoffPendingCityLedger(todayBakuYmd(), folio.id);
    const failed = lines.find((line) => line.level === 'exception');
    if (failed) {
      return sendJson(httpRes, { error: failed.message, code: 'CL_CARD_MISSING' }, 409);
    }
    return sendJson(httpRes, serialize({ folioId: folio.id, status: 'TRANSFERRED_AR', lines }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
