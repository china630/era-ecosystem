/** Lifted from era-hotel-pms/nest/generated/fo_agency-inbox.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { confirmAgencyInboxItem, declineAgencyInboxItem, listAgencyInbox } from '@/lib/services/agency-portal.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const actionSchema = z.object({
  reservationId: z.string().uuid(),
  action: z.enum(['confirm', 'decline']),
  reason: z.string().optional(),
});


@Controller()
export class FoAgencyInboxController {
  @Get("api/fo/agency-inbox")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    await requireHotelModule('hotel_core', session.organizationId);
    return sendJson(httpRes, serialize(await listAgencyInbox()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/fo/agency-inbox")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_core', session.organizationId);
    const body = actionSchema.parse(httpReq.body);
    if (body.action === 'confirm') {
      return sendJson(httpRes, serialize(await confirmAgencyInboxItem(body.reservationId)));
    }
    return sendJson(httpRes, 
      serialize(await declineAgencyInboxItem(body.reservationId, body.reason)),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
