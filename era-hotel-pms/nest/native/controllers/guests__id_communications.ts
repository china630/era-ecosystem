/** Lifted from era-hotel-pms/nest/generated/guests__id_communications.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createGuestCommunication, listGuestCommunications } from '@/lib/services/guest-crm.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']),
  subject: z.string().optional(),
  body: z.string().min(1),
  recipient: z.string().optional(),
});


@Controller()
export class GuestsIdCommunicationsController {
  @Get("api/guests/:id/communications")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const { id } = httpReq.params;
    const channel = requestUrl.searchParams.get('channel') ?? undefined;
    return sendJson(httpRes, serialize(await listGuestCommunications(id, channel ?? undefined)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/guests/:id/communications")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createGuestCommunication(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
