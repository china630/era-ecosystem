import { Controller, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";
import { reconcileClinicStayOrganization } from "@/lib/stay-reconcile";


/**
 * 06:00 and 18:00 Asia/Baku, and on demand.
 * Opens a missing in-house course, closes a checked-out or departed guest,
 * and copies package, room, name, sex, and birth date when the live event was lost.
 * The planned checkout date does not close a course.
 */

@Controller()
export class CronEpisodeHotelCheckoutController {

  @Post("api/cron/episode-hotel-checkout")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_sanatorium",
        authorization: nestHeader(httpReq, "authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => reconcileClinicStayOrganization(organizationId),
    );
    if (!gate.ok) {
      if (gate.status === 401) throw new HttpException("Unauthorized", 401);
      if (gate.status === 503) throw new HttpException({ error: gate.reason }, 503);
      return { skipped: true, reason: gate.reason, moduleKey: gate.moduleKey };
    }
    return { byOrganization: gate.results };
  
        });
  }
}
