/** Lifted from era-hotel-pms/nest/generated/reports_pack_download.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import JSZip from 'jszip';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug, validatePackSlugs } from '@/lib/reports/catalog';
import { resolveNightAuditPackSlugs } from '@/lib/reports/night-audit-pack';
import { parseReportLangParam, reportFileName } from '@/lib/reports/locale';
import { reportPdfT } from '@/lib/reports/pdf-i18n';
import { renderLayoutPdf } from '@/lib/services/reports/pdf-renderers';
import { queryReportLayout, reportPeriodLabel } from '@/lib/services/reports/report-output';
import { getReportLetterhead } from '@/lib/services/hotel-letterhead.service';
import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { resolveDateMode } from '@/lib/reports/period';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsPackDownloadController {
  @Get("api/reports/pack/download")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const url = requestUrl;
    const businessDate = url.searchParams.get('businessDate');
    if (!businessDate) return sendJson(httpRes, { error: 'Missing businessDate query param' }, 400);

    const lang = parseReportLangParam({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    if (!lang.ok) return sendJson(httpRes, { error: lang.message }, 400);

    const slugs = await resolveNightAuditPackSlugs();
    const pack = validatePackSlugs(slugs);
    if (!pack.ok) return sendJson(httpRes, { error: pack.message }, 400);

    const letterhead = await getReportLetterhead();
    const propertyName = letterhead.name || 'Hotel';
    const t = reportPdfT(lang.locale);
    const zip = new JSZip();
    let added = 0;

    for (let i = 0; i < pack.slugs.length; i++) {
      const slug = pack.slugs[i];
      const def = getReportBySlug(slug);
      if (!def) continue;
      try {
        const range = resolveDateMode(def.dateMode, bakuCivilUtcDate(businessDate));
        const from = hotelDateKey(range.from);
        const to = hotelDateKey(range.to);
        const layout = await queryReportLayout(slug, from, to, lang.locale);
        const buf = await renderLayoutPdf(layout, {
          propertyName,
          letterhead,
          locale: lang.locale,
          title: t(def.titleKey),
          subtitle: reportPeriodLabel(from, to),
          t,
        });
        const order = String(i + 1).padStart(2, '0');
        zip.file(reportFileName(`${order}_${slug}`, lang.locale, businessDate, 'pdf'), buf);
        added += 1;
      } catch (err) {
        console.error(`[reports] pack member ${slug} failed`, err);
        continue;
      }
    }

    if (added === 0) return sendJson(httpRes, { error: 'ZIP pack has no enabled members' }, 400);

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

    return new Response(new Uint8Array(zipBuf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${reportFileName('nightly_pack', lang.locale, businessDate, 'zip')}"`,
      },
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
