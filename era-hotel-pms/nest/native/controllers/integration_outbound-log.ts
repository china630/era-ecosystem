/** Lifted from era-hotel-pms/nest/generated/integration_outbound-log.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listOutboundEventLog } from '@/lib/integration/event-dispatcher';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class IntegrationOutboundLogController {
  @Get("api/integration/outbound-log")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.INTEGRATION_ADMIN);
    const url = requestUrl;
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const status = url.searchParams.get('status') ?? undefined;
    const logs = await listOutboundEventLog({ limit, status });
    return sendJson(httpRes, serialize(logs));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
