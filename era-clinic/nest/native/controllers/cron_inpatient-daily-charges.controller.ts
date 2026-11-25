import { Controller, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { postDailyWardCharges } from "@/domain/inpatient/daily-charge.service";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";
import { bakuCivilUtcDate } from "@/lib/baku-day";

@Controller()
export class CronInpatientDailyChargesController {

  @Post("api/cron/inpatient-daily-charges")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_inpatient",
        authorization: nestHeader(httpReq, "authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => {
        const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
        const dateParam = url.searchParams.get("date");
        const chargeDate = dateParam ? bakuCivilUtcDate(dateParam) : new Date();
        const result = await postDailyWardCharges(chargeDate);
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
