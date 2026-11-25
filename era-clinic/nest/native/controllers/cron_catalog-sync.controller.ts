import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";


/** Service-token cron stub. SHARED: orch pool registry (kit). */

@Controller()
export class CronCatalogSyncController {

  @Post("api/cron/catalog-sync")
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
      const base = process.env.ERA_CLINIC_URL ?? "http://127.0.0.1:3203";
      const res = await fetch(`${base.replace(/\/$/, "")}/api/catalog/sync`, {
        method: "POST",
        headers: { cookie: nestHeader(httpReq, "cookie") ?? "" },
      });
      return {
        organizationId,
        status: res.status,
        data: httpReq.body,
      };
    },
  );
  if (!gate.ok) {
    if (gate.status === 401) {
      throw new HttpException({ error: "Unauthorized" }, 401);
    }
    if (gate.status === 503) {
      throw new HttpException({ error: gate.reason }, 503);
    }
    return {
      skipped: true,
      reason: gate.reason,
      moduleKey: gate.moduleKey,
    };
  }
  return { byOrganization: gate.results };

        });
  }
}
