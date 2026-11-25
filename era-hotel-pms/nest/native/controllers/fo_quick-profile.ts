/** Lifted from era-hotel-pms/nest/generated/fo_quick-profile.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createQuickAgency, createQuickCompany } from '@/lib/services/quick-profile.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('AGENCY'),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(32),
  }),
  z.object({
    kind: z.literal('COMPANY'),
    name: z.string().trim().min(1).max(120),
    voen: z.string().trim().regex(/^\d{10}$/),
  }),
]);


@Controller()
export class FoQuickProfileController {
  @Post("api/fo/quick-profile")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const body = schema.parse(httpReq.body);
    const row =
      body.kind === 'AGENCY'
        ? await createQuickAgency({ name: body.name, phone: body.phone })
        : await createQuickCompany({ name: body.name, voen: body.voen });
    return sendJson(httpRes, serialize(row));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
