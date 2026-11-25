/** Lifted from era-hotel-pms/nest/generated/cron_auto-bar.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { addHotelDays } from "@/lib/hotel-calendar";
import { applyAutoBar } from "@/lib/services/auto-bar-engine.service";
import { fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Nightly auto-BAR. SHARED: orch pool registry (kit). */


@Controller()
export class CronAutoBarController {
  @Post("api/cron/auto-bar")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_hotel_pms",
        moduleKey: "hotel_setup_advanced",
        authorization: nestHeader(httpReq, "authorization"),
        cronSecretEnv: "HOTEL_CRON_SECRET",
        fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
      },
      async (organizationId) => {
        const fromKey = todayBakuYmd();
        const from = bakuCivilUtcDate(fromKey);
        const to = bakuCivilUtcDate(addHotelDays(fromKey, 90));
        const result = await applyAutoBar({ from, to });
        return {
          organizationId,
          ...result,
          from: fromKey,
          to: addHotelDays(fromKey, 90),
        };
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) {
        return sendJson(httpRes, { error: gate.reason }, 503);
      }
      return sendJson(httpRes, { skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }
    return sendJson(httpRes, { byOrganization: gate.results });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
