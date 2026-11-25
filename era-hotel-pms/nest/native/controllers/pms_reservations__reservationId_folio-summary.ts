/** Lifted from era-hotel-pms/nest/generated/pms_reservations__reservationId_folio-summary.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { getFolioSummaryForPos } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PmsReservationsReservationIdFolioSummaryController {
  @Get("api/pms/reservations/:reservationId/folio-summary")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.FOLIO_READ);
    const { reservationId } = httpReq.params;
    return sendJson(httpRes, serialize(await getFolioSummaryForPos(reservationId)));
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
