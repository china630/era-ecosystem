/** Lifted from era-hotel-pms/nest/generated/hotel_profile.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getHotelProfile, upsertHotelProfile } from '@/lib/services/hotel.service';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { resolveCpLetterheadLocks } from '@/lib/services/cp-letterhead-locks';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim()));

const schema = z.object({
  name: z.string().min(1),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  propertyCode: z.string().min(1).optional(),
  roomCapacity: z.number().int().min(0).optional(),
  bedCapacity: z.number().int().min(0).nullish(),
  printName: optionalText(200),
  address: optionalText(500),
  phone: optionalText(60),
  email: optionalText(200).refine((v) => v == null || z.string().email().safeParse(v).success, {
    message: 'Invalid email',
  }),
  website: optionalText(200),
});


@Controller()
export class HotelProfileController {
  @Get("api/hotel/profile")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.HOTEL_PROFILE,
      PERMISSIONS.REPORTS_READ,
    ]);
    const profile = await getHotelProfile();
    const controlPlane = await resolveCpLetterheadLocks();
    return sendJson(httpRes, serialize({ ...(profile ?? {}), controlPlane }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/hotel/profile")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOTEL_PROFILE);
    const body = schema.parse(httpReq.body);
    const locks = await resolveCpLetterheadLocks();
    const next = { ...body };
    // CP-ORG-PROFILE-01: strip legal chrome fields owned by orch when Sync cache present.
    if (locks.address) next.address = undefined;
    if (locks.phone) next.phone = undefined;
    if (locks.email) next.email = undefined;
    if (locks.website) next.website = undefined;
    const profile = await upsertHotelProfile(next);
    const controlPlane = locks;
    return sendJson(httpRes, serialize({ ...(profile ?? {}), controlPlane }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
