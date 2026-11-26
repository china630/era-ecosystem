/** Lifted from era-hotel-pms/nest/generated/housekeeping_lost-found.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createLostFound, listLostFound, updateLostFoundStatus } from '@/lib/services/wave-b-master.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  foundDate: z.coerce.date(),
  location: z.string().min(1),
  description: z.string().min(1),
  roomNumber: z.string().max(32).optional(),
  photoData: z.string().max(1_600_000).optional(),
  guestId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['OPEN', 'RETURNED', 'DISPOSED']),
});


@Controller()
export class HousekeepingLostFoundController {
  @Get("api/housekeeping/lost-found")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const guestId = requestUrl.searchParams.get('guestId') ?? undefined;
    return sendJson(httpRes, serialize(await listLostFound(guestId)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/housekeeping/lost-found")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = statusSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateLostFoundStatus(body.id, body.status)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/lost-found")
  @HttpCode(200)
  async post_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(httpReq.body);
    if (body.photoData && !body.photoData.startsWith('data:image/')) {
      body.photoData = undefined;
    }
    return sendJson(httpRes, serialize(await createLostFound(body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
