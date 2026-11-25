import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import { nestHeader, withClinicHttp } from "../../bridge";
import { generateMarAdministrationsForOrganization } from "@/domain/inpatient/mar-generate.service";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";

@Controller()
export class CronInpatientMarGenerateController {

  @Post("api/cron/inpatient-mar-generate")
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
        const result = await generateMarAdministrationsForOrganization(organizationId);
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