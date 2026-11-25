import { Controller, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { processAppointmentRemindersForOrganization } from "@/domain/appointment/appointment-calendar.service";


/** SHARED: orch pool registry (kit). */

@Controller()
export class CronAppointmentRemindersController {

  @Post("api/cron/appointment-reminders")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "platform_notifications",
        authorization: nestHeader(httpReq, "authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => {
        const { scanned, sent } = await processAppointmentRemindersForOrganization(
          organizationId,
        );
        return { organizationId, scanned, sent };
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
