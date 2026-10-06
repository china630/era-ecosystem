import { jsonError, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { parseReportLangParam, reportFileName } from '@/lib/reports/locale';
import { reportPdfT } from '@/lib/reports/pdf-i18n';
import { isImplementedReportSlug } from '@/lib/services/reports';
import { renderLayoutPdf } from '@/lib/services/reports/pdf-renderers';
import { queryReportLayout, reportPeriodLabel } from '@/lib/services/reports/report-output';
import { getReportLetterhead } from '@/lib/services/hotel-letterhead.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const { slug } = await params;
    const def = getReportBySlug(slug);
    if (!def) return jsonError(`Unknown report: ${slug}`, 404);

    if (!isImplementedReportSlug(slug)) {
      return jsonError(`Report "${slug}" is not implemented`, 501);
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return jsonError('Missing from/to query params', 400);

    const lang = parseReportLangParam(request);
    if (!lang.ok) return jsonError(lang.message, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const [layout, letterhead] = await Promise.all([
      queryReportLayout(slug, from, to, lang.locale, dim ? { dim } : undefined),
      getReportLetterhead(),
    ]);

    const t = reportPdfT(lang.locale);
    const buffer = await renderLayoutPdf(layout, {
      propertyName: letterhead.name || 'Hotel',
      letterhead,
      locale: lang.locale,
      title: t(def.titleKey),
      subtitle: reportPeriodLabel(from, to),
      t,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${reportFileName(slug, lang.locale, from, 'pdf')}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
