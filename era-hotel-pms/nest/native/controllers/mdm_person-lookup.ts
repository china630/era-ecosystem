/** Lifted from era-hotel-pms/nest/generated/mdm_person-lookup.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { lookupGlobalPersonByFin, resolvePersonIdentity } from '@era/satellite-kit';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { buildMdmPersonLookupBody } from '@/lib/mdm-person-lookup-body';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z
  .object({
    fin: z.string().trim().optional(),
    passport: z.string().trim().optional(),
    issuingCountry: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      Boolean(d.fullName?.trim()) ||
      Boolean(d.firstName?.trim() && d.lastName?.trim()),
    { message: 'fullName or firstName+lastName required' },
  );

/** Resolve MDM global person id from FIN / passport (SP7 guest linkage). */


@Controller()
export class MdmPersonLookupController {
  @Post("api/mdm/person-lookup")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const parsed = schema.safeParse(httpReq.body);
    if (!parsed.success) {
      return sendJson(httpRes, { error: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
    }
    const body = parsed.data;
    if (body.fin) {
      const result = await lookupGlobalPersonByFin(body.fin);
      if (result.globalPersonId) return sendJson(httpRes, result);
    }
    const resolveBody = buildMdmPersonLookupBody(body);
    const resolved = await resolvePersonIdentity(resolveBody);
    return sendJson(httpRes, {
      globalPersonId: resolved.globalPersonId,
      masked: false,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
