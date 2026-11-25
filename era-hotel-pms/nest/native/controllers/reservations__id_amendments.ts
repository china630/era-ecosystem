/** Lifted from era-hotel-pms/nest/generated/reservations__id_amendments.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyStayAmendment } from '@/lib/services/stay-amendment.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  effectiveDate: z.coerce.date(),
  roomTypeId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
});


@Controller()
export class ReservationsIdAmendmentsController {
  @Post("api/reservations/:id/amendments")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, 
      await applyStayAmendment({
        reservationId: id,
        effectiveDate: body.effectiveDate,
        roomTypeId: body.roomTypeId,
        ratePlanId: body.ratePlanId,
        audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      }),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
