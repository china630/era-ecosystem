/** Lifted from era-hotel-pms/nest/generated/folios_pay-targets.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listCashierPayTargets } from '@/lib/services/cashier-pay-targets.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class FoliosPayTargetsController {
  @Get("api/folios/pay-targets")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const q = requestUrl.searchParams.get('q') ?? '';
    return sendJson(httpRes, await listCashierPayTargets(q));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
