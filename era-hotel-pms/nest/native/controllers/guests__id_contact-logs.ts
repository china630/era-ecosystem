/** Lifted from era-hotel-pms/nest/generated/guests__id_contact-logs.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listGuestContactLogs } from '@/lib/services/guest-crm.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class GuestsIdContactLogsController {
  @Get("api/guests/:id/contact-logs")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listGuestContactLogs(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
