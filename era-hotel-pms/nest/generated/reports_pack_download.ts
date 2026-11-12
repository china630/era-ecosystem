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
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/pack/download", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const url = new URL(request.url);
    const businessDate = url.searchParams.get('businessDate');
    if (!businessDate) return sendJson(httpRes, { error: 'Missing businessDate query param' }, 400);

    const lang = parseReportLangParam(request);
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
