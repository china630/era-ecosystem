import JSZip from 'jszip';
import { jsonError, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
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

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const url = new URL(request.url);
    const businessDate = url.searchParams.get('businessDate');
    if (!businessDate) return jsonError('Missing businessDate query param', 400);

    const lang = parseReportLangParam(request);
    if (!lang.ok) return jsonError(lang.message, 400);

    const slugs = await resolveNightAuditPackSlugs();
    const pack = validatePackSlugs(slugs);
    if (!pack.ok) return jsonError(pack.message, 400);

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

    if (added === 0) return jsonError('ZIP pack has no enabled members', 400);

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

    return new Response(new Uint8Array(zipBuf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${reportFileName('nightly_pack', lang.locale, businessDate, 'zip')}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
