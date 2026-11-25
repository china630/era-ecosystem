/** Lifted from era-hotel-pms/nest/generated/reservations__id_card-authorizations.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createCheckInHold, listAuthorizations, captureAuthorization, releaseAuthorization } from '@/lib/services/card-auth.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const holdSchema = z.object({ amount: z.number().positive() });


@Controller()
export class ReservationsIdCardAuthorizationsController {
  @Get("api/reservations/:id/card-authorizations")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listAuthorizations(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/reservations/:id/card-authorizations")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = holdSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createCheckInHold(id, body.amount)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/reservations/:id/card-authorizations")
  @HttpCode(200)
  async patch_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = z
      .object({
        authorizationId: z.string().uuid(),
        action: z.enum(['capture', 'release']),
        amount: z.number().positive().optional(),
      })
      .parse(httpReq.body);

    if (body.action === 'capture') {
      return sendJson(httpRes, serialize(await captureAuthorization(body.authorizationId, body.amount)));
    }
    return sendJson(httpRes, serialize(await releaseAuthorization(body.authorizationId)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
