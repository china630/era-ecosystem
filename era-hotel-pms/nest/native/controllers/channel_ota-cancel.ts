/** Lifted from era-hotel-pms/nest/generated/channel_ota-cancel.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { handleOtaCancel } from '@/lib/services/channel.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z
  .object({
    otaReference: z.string().min(1).optional(),
    externalRef: z.string().min(1).optional(),
    reservationId: z.string().uuid().optional(),
  })
  .refine((b) => Boolean(b.otaReference || b.externalRef || b.reservationId), {
    message: 'externalRef, otaReference, or reservationId required',
  });


@Controller()
export class ChannelOtaCancelController {
  @Post("api/channel/ota-cancel")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await handleOtaCancel(body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
