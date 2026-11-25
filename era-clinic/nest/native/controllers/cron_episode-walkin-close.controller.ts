import { Controller, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { closeIdleWalkInEpisodes } from "@/lib/services/sanatorium.service";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";


/**
 * Weekly idle walk-in close (CLI-55).
 * Bearer PLATFORM_CRON_SECRET — same tenant loop as other clinic crons.
 */

@Controller()
export class CronEpisodeWalkinCloseController {

  @Post("api/cron/episode-walkin-close")
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
      async (organizationId) => {
        const result = await closeIdleWalkInEpisodes();
        return { organizationId, ...result };
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) throw new HttpException("Unauthorized", 401);
      if (gate.status === 503) {
        throw new HttpException({ error: gate.reason }, 503);
      }
      return { skipped: true, reason: gate.reason, moduleKey: gate.moduleKey };
    }
    return { byOrganization: gate.results };
  
        });
  }
}
