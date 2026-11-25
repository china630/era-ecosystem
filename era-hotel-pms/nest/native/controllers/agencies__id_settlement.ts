/** Lifted from era-hotel-pms/nest/generated/agencies__id_settlement.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { listAgencyTransferredFolios } from '@/lib/services/agency-settlement.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AgenciesIdSettlementController {
  @Get("api/agencies/:id/settlement")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listAgencyTransferredFolios(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/agencies/:id/settlement")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    // Hotel does not accept agency money: it must be booked in Finance.
    return sendJson(httpRes, 
      {
        error: 'Agency settlement is paid in Finance only (City Ledger handoff).',
        code: 'FINANCE_ONLY_SETTLEMENT',
      }, 409);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
