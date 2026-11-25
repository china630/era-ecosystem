/** Lifted from era-hotel-pms/nest/generated/banquets__id_day-sheet.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { getBanquetDaySheet } from '@/lib/services/banquet.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class BanquetsIdDaySheetController {
  @Get("api/banquets/:id/day-sheet")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getBanquetDaySheet(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
