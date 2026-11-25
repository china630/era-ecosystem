import { Controller, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { sweepNoShowScheduled, sweepUnpaidMissed } from "@/domain/procedure/procedure-day-close.service";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";

@Controller()
export class CronProcedureNoShowSweepController {

  @Post("api/cron/procedure-no-show-sweep")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        authorization: nestHeader(httpReq, "authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => {
        const result = await sweepNoShowScheduled();
        const unpaidMissed = await sweepUnpaidMissed();
        return { organizationId, ...result, unpaidMissed };
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
