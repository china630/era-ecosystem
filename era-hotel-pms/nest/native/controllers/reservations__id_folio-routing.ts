/** Lifted from era-hotel-pms/nest/generated/reservations__id_folio-routing.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReservationFolioRouting, upsertReservationFolioRouting } from '@/lib/services/reservation-submodals.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const putSchema = z.object({
  overrides: z.array(
    z.object({
      revenueCodeId: z.string().uuid(),
      targetFolioType: z.enum(['GUEST', 'COMPANY', 'AGENCY']),
    }),
  ),
});


@Controller()
export class ReservationsIdFolioRoutingController {
  @Get("api/reservations/:id/folio-routing")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getReservationFolioRouting(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/reservations/:id/folio-routing")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const { id } = httpReq.params;
    const body = putSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await upsertReservationFolioRouting(id, body.overrides)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
