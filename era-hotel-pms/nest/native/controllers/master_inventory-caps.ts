/** Lifted from era-hotel-pms/nest/generated/master_inventory-caps.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getInventoryCaps, updateHouseOverbook } from '@/lib/services/master-data.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  houseOverbookAllowance: z.number().int().nonnegative(),
});


@Controller()
export class MasterInventoryCapsController {
  @Get("api/master/inventory-caps")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.ROOMS_ADMIN);
    return sendJson(httpRes, serialize(await getInventoryCaps()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/master/inventory-caps")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ROOMS_ADMIN);
    const body = schema.parse(httpReq.body);
    await updateHouseOverbook(body.houseOverbookAllowance, { userId: session?.sub });
    return sendJson(httpRes, serialize(await getInventoryCaps()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
