import { jsonError, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { parseReportLangParam } from '@/lib/reports/locale';
import { reportToXlsxBuffer } from '@/lib/reports/excel';
import { isImplementedReportSlug, queryReport } from '@/lib/services/reports';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
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
    const data = await queryReport(slug, from, to, dim ? { dim } : undefined);
    const buffer = reportToXlsxBuffer(data, lang.locale);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${slug}_${from}.xlsx"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
