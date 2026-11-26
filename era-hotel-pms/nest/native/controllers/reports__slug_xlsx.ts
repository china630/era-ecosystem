/** Lifted from era-hotel-pms/nest/generated/reports__slug_xlsx.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { parseReportLangParam, reportFileName } from '@/lib/reports/locale';
import { layoutToXlsxBuffer } from '@/lib/reports/excel';
import { formatReportTimestamp, reportPdfT } from '@/lib/reports/pdf-i18n';
import { isImplementedReportSlug } from '@/lib/services/reports';
import { queryReportLayout, reportPeriodLabel } from '@/lib/services/reports/report-output';
import { getReportLetterhead } from '@/lib/services/hotel-letterhead.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsSlugXlsxController {
  @Get("api/reports/:slug/xlsx")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const { slug } = httpReq.params;
    const def = getReportBySlug(slug);
    if (!def) return sendJson(httpRes, { error: `Unknown report: ${slug}` }, 404);

    if (!isImplementedReportSlug(slug)) {
      return sendJson(httpRes, { error: `Report "${slug}" is not implemented` }, 501);
    }

    const url = requestUrl;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return sendJson(httpRes, { error: 'Missing from/to query params' }, 400);

    const lang = parseReportLangParam({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    if (!lang.ok) return sendJson(httpRes, { error: lang.message }, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const [layout, letterhead] = await Promise.all([
      queryReportLayout(slug, from, to, lang.locale, dim ? { dim } : undefined),
      getReportLetterhead(),
    ]);
    const t = reportPdfT(lang.locale);
    const buffer = await layoutToXlsxBuffer(layout, {
      letterhead,
      title: t(def.titleKey),
      period: reportPeriodLabel(from, to),
      generatedAt: formatReportTimestamp(lang.locale),
      noDataLabel: t('reportsPdf.noData'),
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${reportFileName(slug, lang.locale, from, 'xlsx')}"`,
      },
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
