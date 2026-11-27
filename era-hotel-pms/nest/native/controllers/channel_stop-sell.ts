/** Lifted from era-hotel-pms/nest/generated/channel_stop-sell.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createStopSell, listStopSells, removeStopSell } from '@/lib/services/channel.service';
import { maybeAutoPushAfterStopSell } from '@/lib/channel/ota-push.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  date: z.string().min(1),
  roomTypeId: z.string().uuid().optional(),
  note: z.string().optional(),
});


@Controller()
export class ChannelStopSellController {
  @Get("api/channel/stop-sell")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const url = requestUrl;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const list = await listStopSells(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    return sendJson(httpRes, serialize(list));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/channel/stop-sell")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = createSchema.parse(httpReq.body);
    const row = await createStopSell({
      date: new Date(body.date),
      roomTypeId: body.roomTypeId,
      note: body.note,
    });
    await maybeAutoPushAfterStopSell();
    return sendJson(httpRes, serialize(row), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/channel/stop-sell")
  @HttpCode(200)
  async delete_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const id = requestUrl.searchParams.get('id');
    if (!id) throw new Error('id query param required');
    await removeStopSell(id);
    await maybeAutoPushAfterStopSell();
    return sendJson(httpRes, { deleted: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
