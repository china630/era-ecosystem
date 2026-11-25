/** Lifted from era-hotel-pms/nest/generated/admin_guest-dedup_merge.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { GuestDedupNeedsPersonMerge, mergeGuestCards } from '@/lib/services/guest-merge.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  survivorId: z.string().min(1),
  duplicateIds: z.array(z.string().min(1)).min(1),
  confirmPersonMerge: z.boolean().optional(),
});


@Controller()
export class AdminGuestDedupMergeController {
  @Post("api/admin/guest-dedup/merge")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const body = schema.parse(httpReq.body);
    const result = await mergeGuestCards(body);
    return sendJson(httpRes, result);
  } catch (err) {
    if (err instanceof GuestDedupNeedsPersonMerge) {
      return sendJson(httpRes, 
        { error: err.message, needsPersonMerge: true }, 409);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
