/** Lifted from era-hotel-pms/nest/generated/fo_share-rooming-suggestions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { suggestShareDoors } from '@/lib/services/share-assignment.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  reservationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Suggest compatible share doors for an unassigned share-eligible stay. */


@Controller()
export class FoShareRoomingSuggestionsController {
  @Get("api/fo/share-rooming-suggestions")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = requestUrl;
    const parsed = querySchema.parse({
      reservationId: url.searchParams.get('reservationId'),
      limit: url.searchParams.get('limit') ?? undefined,
    });
    const suggestions = await suggestShareDoors(parsed);
    return sendJson(httpRes, serialize(suggestions));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
