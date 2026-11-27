/** Lifted from era-hotel-pms/nest/generated/distribution_agency-commission_lines.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listCommissionLines, markLinesReady } from '@/lib/services/agency-commission.service';
import type { AgencyCommissionLineStatus } from '@prisma/client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const readySchema = z.object({
  lineIds: z.array(z.string().min(1)).min(1),
});


@Controller()
export class DistributionAgencyCommissionLinesController {
  @Get("api/distribution/agency-commission/lines")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.SCREEN_DISTRIBUTION,
    ]);
    const url = requestUrl;
    const from = url.searchParams.get('from') ?? todayBakuYmd();
    const to = url.searchParams.get('to') ?? from;
    const agencyId = url.searchParams.get('agencyId') ?? undefined;
    const status = (url.searchParams.get('status') ?? undefined) as
      | AgencyCommissionLineStatus
      | undefined;
    return sendJson(httpRes, await listCommissionLines({ agencyId, fromYmd: from, toYmd: to, status }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/distribution/agency-commission/lines")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.AGENCY_COMMISSION_ADMIN);
    const body = readySchema.parse(httpReq.body);
    return sendJson(httpRes, await markLinesReady(body.lineIds));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
