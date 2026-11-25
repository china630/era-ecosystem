/** Lifted from era-hotel-pms/nest/generated/distribution_agency-commission_lines__id_hold.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { holdCommissionLine, releaseCommissionHold } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z
  .object({
    reason: z.string().optional(),
    release: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.release) return;
    if (!val.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hold reason required',
        path: ['reason'],
      });
    }
  });


@Controller()
export class DistributionAgencyCommissionLinesIdHoldController {
  @Post("api/distribution/agency-commission/lines/:id/hold")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.AGENCY_COMMISSION_ADMIN);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    if (body.release) {
      return sendJson(httpRes, serialize(await releaseCommissionHold(id)));
    }
    return sendJson(httpRes, serialize(await holdCommissionLine(id, body.reason!.trim())));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
