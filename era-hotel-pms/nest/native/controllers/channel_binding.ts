/** Lifted from era-hotel-pms/nest/generated/channel_binding.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getChannelManagerBinding, isBindingPoolUnavailable, upsertChannelManagerBinding } from '@/lib/channel/channel-manager-binding.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const upsertSchema = z.object({
  provider: z.enum(['off', 'stub', 'webhook', 'channex']).optional(),
  channexPropertyId: z.string().nullable().optional(),
  propertyType: z.enum(['hotel', 'vacation_rental']).optional(),
  live: z.boolean().optional(),
  ibeAllowedOrigins: z.array(z.string()).optional(),
  webhookSecret: z.string().nullable().optional(),
  rotateIbeKey: z.boolean().optional(),
});


@Controller()
export class ChannelBindingController {
  @Get("api/channel/binding")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const binding = await getChannelManagerBinding();
    return sendJson(httpRes, 
      binding ?? {
        organizationId: null,
        provider: 'off',
        channexPropertyId: null,
        propertyType: 'hotel',
        live: false,
        ibePublishableKey: null,
        ibeAllowedOrigins: [],
        hasWebhookSecret: false,
      },
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/channel/binding")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = upsertSchema.parse(httpReq.body);
    const binding = await upsertChannelManagerBinding(body);
    return sendJson(httpRes, binding);
  } catch (err) {
    if (isBindingPoolUnavailable(err)) {
      return sendJson(httpRes, { error: 'Organization registry unavailable' }, 503);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
