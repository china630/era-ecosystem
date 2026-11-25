/** Lifted from era-hotel-pms/nest/generated/guests__id_full.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getGuestFull, patchGuestFull } from '@/lib/services/guest-full.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z
  .object({
    fullName: z.string().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    middleName: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    sex: z.string().nullable().optional(),
    /** @deprecated use sex */
    gender: z.string().nullable().optional(),
    nationality: z.string().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    vipType: z.string().nullable().optional(),
    birthDate: z.string().nullable().optional(),
    birthPlace: z.string().nullable().optional(),
    greyList: z.boolean().optional(),
    problematic: z.boolean().optional(),
    gdprConfirmed: z.boolean().optional(),
    smsConsent: z.boolean().optional(),
    whatsappConsent: z.boolean().optional(),
    phoneConsent: z.boolean().optional(),
    emailConsent: z.boolean().optional(),
    callBack: z.boolean().optional(),
    nationalIdFin: z.string().nullable().optional(),
    voen: z.string().nullable().optional(),
    passportNumber: z.string().nullable().optional(),
    occupation: z.string().nullable().optional(),
    registrationNumber: z.string().nullable().optional(),
    vehiclePlate: z.string().nullable().optional(),
    hotelName: z.string().nullable().optional(),
    visaType: z.string().nullable().optional(),
    visaNumber: z.string().nullable().optional(),
    visaExpiry: z.string().nullable().optional(),
    maritalStatus: z.string().nullable().optional(),
    parentFatherName: z.string().nullable().optional(),
    /** @deprecated use parentFatherName */
    fatherName: z.string().nullable().optional(),
    parentMotherName: z.string().nullable().optional(),
    /** @deprecated use parentMotherName */
    motherName: z.string().nullable().optional(),
    verificationStatus: z.string().nullable().optional(),
    marriageDate: z.string().nullable().optional(),
    bonusPercent: z.number().nullable().optional(),
    phoneVerified: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    isLocked: z.boolean().optional(),
  })
  .transform(({ gender, fatherName, motherName, ...data }) => ({
    ...data,
    sex: data.sex ?? gender,
    parentFatherName: data.parentFatherName ?? fatherName,
    parentMotherName: data.parentMotherName ?? motherName,
  }));


@Controller()
export class GuestsIdFullController {
  @Get("api/guests/:id/full")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getGuestFull(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/guests/:id/full")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await patchGuestFull(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
