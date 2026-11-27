/** Lifted from era-hotel-pms/nest/generated/reports_pack.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { resolveNightAuditPackSlugs } from '@/lib/reports/night-audit-pack';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsPackController {
  @Get("api/reports/pack")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const url = requestUrl;
    const businessDate = url.searchParams.get('businessDate');
    if (!businessDate) return sendJson(httpRes, { error: 'Missing businessDate query param' }, 400);

    const slugs = await resolveNightAuditPackSlugs();
    const reports = slugs
      .map((slug, i) => {
        const def = getReportBySlug(slug);
        return def ? { slug, titleKey: def.titleKey, packOrder: i + 1 } : null;
      })
      .filter(Boolean);

    return sendJson(httpRes, { businessDate, reports });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
