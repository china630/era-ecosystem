/** Lifted from era-hotel-pms/nest/generated/channel_mappings.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createChannel, listChannels } from '@/lib/services/wave-b-master.service';
import { createChannelRateMapping, createChannelRoomMapping } from '@/lib/services/channel.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const channelSchema = z.object({ code: z.string().min(1), name: z.string().min(1) });

const roomMappingSchema = z.object({
  channelId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  otaRoomCode: z.string().min(1).optional(),
});

const rateMappingSchema = z.object({
  channelId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  otaRateCode: z.string().min(1).optional(),
});


@Controller()
export class ChannelMappingsController {
  @Get("api/channel/mappings")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    return sendJson(httpRes, serialize(await listChannels()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/channel/mappings")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = httpReq.body;
    if (body.channelId && body.ratePlanId) {
      const parsed = rateMappingSchema.parse(body);
      const row = await createChannelRateMapping({
        channelId: parsed.channelId,
        ratePlanId: parsed.ratePlanId,
        otaRateCode: parsed.otaRateCode,
      });
      return sendJson(httpRes, serialize(row));
    }
    if (body.channelId && body.roomTypeId) {
      const parsed = roomMappingSchema.parse(body);
      const row = await createChannelRoomMapping({
        channelId: parsed.channelId,
        roomTypeId: parsed.roomTypeId,
        otaRoomCode: parsed.otaRoomCode,
      });
      return sendJson(httpRes, serialize(row));
    }
    const parsed = channelSchema.parse(body);
    return sendJson(httpRes, serialize(await createChannel(parsed)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
