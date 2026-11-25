import { Controller, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { reportClinicRoomBedCapacity } from "@/lib/report-clinic-capacity";
import { runCronForEachTenant } from "@era/satellite-kit";


/** Bearer PLATFORM_CRON_SECRET — reports Room/Bed gauges once per Baku month. */

@Controller()
export class CronClinicCapacityController {

  @Post("api/cron/clinic-capacity")
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
        const counts = await reportClinicRoomBedCapacity(organizationId);
        return { organizationId, ...counts };
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
