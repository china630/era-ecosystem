/** Lifted from era-hotel-pms/nest/generated/admin_guest-dedup_summary.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { getGuestDedupSummary, listDuplicateGroups } from '@/lib/services/guest-dedup.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminGuestDedupSummaryController {
  @Get("api/admin/guest-dedup/summary")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const [summary, groups] = await Promise.all([
      getGuestDedupSummary(),
      listDuplicateGroups(200),
    ]);
    const guestIds = new Set(groups.flatMap((group) => group.guestIds));
    return sendJson(httpRes, 
      serialize({
        summary: {
          ...summary,
          suspectedDuplicateGroups: groups.length,
          suspectedDuplicateGuests: guestIds.size,
        },
        groups,
      }),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
