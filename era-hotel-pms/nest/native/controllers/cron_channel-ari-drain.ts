/** Lifted from era-hotel-pms/nest/generated/cron_channel-ari-drain.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { drainAriQueueForOrg } from '@/lib/channel/channel-ari-queue.service';
import { fetchHotelPoolOrganizationIds } from '@/lib/cron-organization-ids';
import { runCronForEachTenant } from '@era/satellite-kit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Drain ChannelAriJob queue per org (Channex ARI rate limit). */


@Controller()
export class CronChannelAriDrainController {
  @Post("api/cron/channel-ari-drain")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const gate = await runCronForEachTenant(
      {
        satelliteKey: 'industry_hotel_pms',
        moduleKey: 'hotel_distribution',
        authorization: nestHeader(httpReq, 'authorization'),
        cronSecretEnv: 'HOTEL_CRON_SECRET',
        fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
      },
      async (organizationId) => {
        const result = await drainAriQueueForOrg(organizationId);
        return { organizationId, ...result };
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response('Unauthorized', { status: 401 });
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
