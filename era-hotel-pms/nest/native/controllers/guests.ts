/** Lifted from era-hotel-pms/nest/generated/guests.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { createGuestSchema } from '@/lib/guest-input';
import { createGuest, listGuests } from '@/lib/services/guest.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class GuestsController {
  @Get("api/guests")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const params = requestUrl.searchParams;
    const q = params.get('q') ?? undefined;
    const pageRaw = params.get('page');
    const pageSizeRaw = params.get('pageSize');
    const result = await listGuests({
      q,
      page: pageRaw ? Number(pageRaw) : undefined,
      pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
      gender: params.get('gender') ?? undefined,
      nationality: params.get('nationality') ?? undefined,
      fin: params.get('fin') ?? undefined,
      passport: params.get('passport') ?? undefined,
      birthDateFrom: params.get('birthDateFrom') ?? undefined,
      birthDateTo: params.get('birthDateTo') ?? undefined,
      email: params.get('email') ?? undefined,
      phone: params.get('phone') ?? undefined,
      externalRef: params.get('externalRef') ?? undefined,
    });
    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/guests")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const body = createGuestSchema.parse(httpReq.body);
    const guest = await createGuest(body);
    return sendJson(httpRes, serialize(guest), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
