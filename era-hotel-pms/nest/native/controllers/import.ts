/** Lifted from era-hotel-pms/nest/generated/import.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { listImportEntities } from '@/lib/import/adapters';
import { assertHotelImportAccess } from '@/lib/import/auth';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ImportController {
  @Get("api/import")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertHotelImportAccess();
    return sendJson(httpRes, listImportEntities());
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
