/** Lifted from era-hotel-pms/nest/generated/master_lookups.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { HotelLookupKind } from '@prisma/client';
import { serialize } from '@/lib/serialize';
import { createHotelLookup, listHotelLookups } from '@/lib/services/master-data.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const kindSchema = z.nativeEnum(HotelLookupKind);

const createSchema = z.object({
  kind: kindSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  ...localizedNameFields,
  sortOrder: z.number().int().optional(),
});


@Controller()
export class MasterLookupsController {
  @Get("api/master/lookups")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.LOOKUPS_ADMIN,
      PERMISSIONS.LOOKUPS_READ,
    ]);
    const url = requestUrl;
    const kindRaw = url.searchParams.get('kind');
    const activeOnly = url.searchParams.get('activeOnly') === '1';
    const kind = kindRaw ? kindSchema.parse(kindRaw) : undefined;
    return sendJson(httpRes, serialize(await listHotelLookups(kind, activeOnly)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/master/lookups")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.LOOKUPS_ADMIN);
    const body = createSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createHotelLookup(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
