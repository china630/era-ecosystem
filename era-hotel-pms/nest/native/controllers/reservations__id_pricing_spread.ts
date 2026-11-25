/** Lifted from era-hotel-pms/nest/generated/reservations__id_pricing_spread.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyStayPercent, spreadManualNightly, spreadStayTotal } from '@/lib/services/reservation-pricing.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  kind: z.enum(['NIGHTLY', 'STAY_TOTAL', 'PERCENT']),
  value: z.number(),
});


@Controller()
export class ReservationsIdPricingSpreadController {
  @Post("api/reservations/:id/pricing/spread")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    if (body.kind === 'NIGHTLY') {
      return sendJson(httpRes, serialize(await spreadManualNightly(id, body.value)));
    }
    if (body.kind === 'STAY_TOTAL') {
      return sendJson(httpRes, serialize(await spreadStayTotal(id, body.value)));
    }
    return sendJson(httpRes, serialize(await applyStayPercent(id, body.value)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
