/** Lifted from era-hotel-pms/nest/generated/hotel_profile_logo.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { deleteHotelLogo, readHotelLogo, saveHotelLogo } from '@/lib/services/hotel-letterhead.service';
import { resolveCpLetterheadLocks } from '@/lib/services/cp-letterhead-locks';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HotelProfileLogoController {
  @Get("api/hotel/profile/logo")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.HOTEL_PROFILE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    const logo = await readHotelLogo();
    if (!logo) return sendJson(httpRes, { error: 'Logo not set' }, 404);
    return sendBytes(httpRes, Buffer.from(logo.buffer), { 'Content-Type': logo.mimeType, 'Cache-Control': 'no-store' });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/hotel/profile/logo")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOTEL_PROFILE);
    const locks = await resolveCpLetterheadLocks();
    if (locks.logo) {
      return sendJson(httpRes, { error: 
        'Logo is managed on the Control Plane organization profile' }, 400);
    }
    const form = await readNestForm(httpReq);
    const file = form.get('file');
    if (!(file instanceof File)) return sendJson(httpRes, { error: 'file required' }, 400);
    const profile = await saveHotelLogo({
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });
    return sendJson(httpRes, serialize(profile), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/hotel/profile/logo")
  @HttpCode(200)
  async delete_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOTEL_PROFILE);
    const locks = await resolveCpLetterheadLocks();
    if (locks.logo) {
      return sendJson(httpRes, { error: 
        'Logo is managed on the Control Plane organization profile' }, 400);
    }
    return sendJson(httpRes, serialize(await deleteHotelLogo()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
