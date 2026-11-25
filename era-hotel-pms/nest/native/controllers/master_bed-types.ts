/** Lifted from era-hotel-pms/nest/generated/master_bed-types.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { createBedType, listBedTypes } from '@/lib/services/master-data.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  ...localizedNameFields,
  systemType: z.string().optional(),
});


@Controller()
export class MasterBedTypesController {
  @Get("api/master/bed-types")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.ROOMS_ADMIN);
    return sendJson(httpRes, serialize(await listBedTypes()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/master/bed-types")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ROOMS_ADMIN);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createBedType(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
