/** Lifted from era-hotel-pms/nest/generated/guests__id_crm-extension.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getGuestCrmExtension, upsertGuestCrmExtension } from '@/lib/services/guest-crm-extension.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  interests: z.array(z.string()).optional(),
  socialMedia: z.record(z.string()).optional(),
  generalCrmNotes: z.string().optional(),
});


@Controller()
export class GuestsIdCrmExtensionController {
  @Get("api/guests/:id/crm-extension")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getGuestCrmExtension(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/guests/:id/crm-extension")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    await upsertGuestCrmExtension(id, body);
    return sendJson(httpRes, serialize(await getGuestCrmExtension(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
