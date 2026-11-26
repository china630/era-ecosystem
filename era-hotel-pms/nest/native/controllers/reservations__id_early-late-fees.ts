/** Lifted from era-hotel-pms/nest/generated/reservations__id_early-late-fees.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { previewEarlyLateFees } from '@/lib/services/early-late-fees.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdEarlyLateFeesController {
  @Get("api/reservations/:id/early-late-fees")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = httpReq.params;
    const q = requestUrl.searchParams;
    return sendJson(httpRes, 
      serialize(
        await previewEarlyLateFees(id, {
          checkInTime: q.get('checkInTime') ?? undefined,
          checkOutTime: q.get('checkOutTime') ?? undefined,
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
