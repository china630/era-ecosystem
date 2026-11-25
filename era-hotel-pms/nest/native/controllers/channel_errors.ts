/** Lifted from era-hotel-pms/nest/generated/channel_errors.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listSyncErrors, logSyncError, resolveSyncError } from '@/lib/services/channel.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  reservationId: z.string().uuid().optional(),
  otaReference: z.string().optional(),
  errorMessage: z.string().min(1),
});


@Controller()
export class ChannelErrorsController {
  @Get("api/channel/errors")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    return sendJson(httpRes, serialize(await listSyncErrors()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/channel/errors")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await logSyncError(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/channel/errors")
  @HttpCode(200)
  async patch_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const id = requestUrl.searchParams.get('id');
    if (!id) throw new Error('id query required');
    return sendJson(httpRes, serialize(await resolveSyncError(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
