import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { runCronForEachTenant, runWithSatelliteTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { evaluateAndPublishCapacity, getCapacitySummary } from "@/lib/capacity.service";


function unauthorized() {
  throw new HttpException({ error: "Unauthorized" }, 401);
}

function authorize(request: Request): boolean {
  const secret = nestHeader(request, "x-clinic-bridge-secret");
  const expected = process.env.CLINIC_BRIDGE_SECRET;
  return Boolean(expected && secret === expected);
}

/**
 * Read capacity summary (bridge S2S).
 * Tenant: the caller's `x-era-organization-id` (service path; no process bind).
 */


/**
 * Evaluate + publish bus event when risk level changes (cron / hotel sync).
 * Multi-org: orch pool registry (kit). Auth: Bearer CLINIC_BRIDGE_SECRET or legacy x-clinic-bridge-secret.
 */

@Controller()
export class CapacitySummaryController {

  @Get("api/capacity/summary")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!authorize(httpReq)) return unauthorized();
  const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
  const ref = url.searchParams.get("date");
  const refDate = ref ? new Date(ref) : new Date();
  const organizationId = nestHeader(httpReq, "x-era-organization-id")?.trim();
  if (!organizationId) {
    throw new HttpException({ error: "x-era-organization-id required" }, 400);
  }
  return runWithSatelliteTenant({ organizationId }, async () => {
    const summary = await getCapacitySummary(refDate);
    return summary;
  });

        });
  }

  @Post("api/capacity/summary")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const legacy = nestHeader(httpReq, "x-clinic-bridge-secret");
  const authorization =
    nestHeader(httpReq, "authorization") ??
    (legacy ? `Bearer ${legacy}` : null);

  const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
  const ref = url.searchParams.get("date");
  const refDate = ref ? new Date(ref) : new Date();

  const gate = await runCronForEachTenant(
    {
      satelliteKey: "industry_clinic",
      authorization,
      cronSecretEnv: "CLINIC_BRIDGE_SECRET",
      fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
    },
    async (organizationId) => {
      const result = await evaluateAndPublishCapacity(refDate);
      return { organizationId, ...result };
    },
  );

  if (!gate.ok) {
    if (gate.status === 401) return unauthorized();
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
