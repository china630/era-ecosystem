/** Lifted from era-hotel-pms/nest/generated/guests_mrz-match.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { parseMrz } from '@/lib/mrz/parse';
import { matchMrzGuest } from '@/lib/mrz/match-guest';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  text: z.string().min(20),
  currentGuestId: z.string().nullable().optional(),
});


@Controller()
export class GuestsMrzMatchController {
  @Post("api/guests/mrz-match")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_MRZ);
    const body = schema.parse(httpReq.body);
    const parsed = parseMrz(body.text);
    if (!parsed) return sendJson(httpRes, { parsed: null, match: { kind: 'none' } });
    const match = parsed.checksOk
      ? await matchMrzGuest(parsed, body.currentGuestId)
      : { kind: 'none' as const };
    return sendJson(httpRes, { parsed, match });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
