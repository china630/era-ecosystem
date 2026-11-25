/** Lifted from era-hotel-pms/nest/generated/reports__slug_layout.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { parseReportLangParam } from '@/lib/reports/locale';
import { isImplementedReportSlug } from '@/lib/services/reports';
import { queryReportLayout } from '@/lib/services/reports/report-output';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Returns `{ layout }`: the same sections the PDF and Excel exports draw.
 * Lives under `/layout` because static analytics routes (`guest-demographics`, `agency-profitability`)
 * shadow `/api/reports/[slug]` for their slugs.
 */


@Controller()
export class ReportsSlugLayoutController {
  @Get("api/reports/:slug/layout")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const { slug } = httpReq.params;
    const def = getReportBySlug(slug);
    if (!def) return sendJson(httpRes, { error: `Unknown report: ${slug}` }, 404);

    if (!isImplementedReportSlug(slug)) {
      return sendJson(httpRes, { error: `Report "${slug}" query not implemented` }, 501);
    }

    const url = requestUrl;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return sendJson(httpRes, { error: 'Missing from/to query params' }, 400);

    const lang = parseReportLangParam({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    if (!lang.ok) return sendJson(httpRes, { error: lang.message }, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const layout = await queryReportLayout(slug, from, to, lang.locale, dim ? { dim } : undefined);
    return sendJson(httpRes, { layout });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Get("api/reports/:slug")
  @HttpCode(200)
  async get_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const { slug } = httpReq.params;
    const def = getReportBySlug(slug);
    if (!def) return sendJson(httpRes, { error: `Unknown report: ${slug}` }, 404);

    if (!isImplementedReportSlug(slug)) {
      return sendJson(httpRes, { error: `Report "${slug}" query not implemented` }, 501);
    }

    const url = requestUrl;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return sendJson(httpRes, { error: 'Missing from/to query params' }, 400);

    const lang = parseReportLangParam({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    if (!lang.ok) return sendJson(httpRes, { error: lang.message }, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const layout = await queryReportLayout(slug, from, to, lang.locale, dim ? { dim } : undefined);
    return sendJson(httpRes, { layout });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
