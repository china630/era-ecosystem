import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { parseReportLangParam } from '@/lib/reports/locale';
import { isImplementedReportSlug } from '@/lib/services/reports';
import { queryReportLayout } from '@/lib/services/reports/report-output';

/**
 * Returns `{ layout }`: the same sections the PDF and Excel exports draw.
 * Lives under `/layout` because static analytics routes (`guest-demographics`, `agency-profitability`)
 * shadow `/api/reports/[slug]` for their slugs.
 */
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
      return jsonError(`Report "${slug}" query not implemented`, 501);
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return jsonError('Missing from/to query params', 400);

    const lang = parseReportLangParam(request);
    if (!lang.ok) return jsonError(lang.message, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const layout = await queryReportLayout(slug, from, to, lang.locale, dim ? { dim } : undefined);
    return jsonOk({ layout });
  } catch (err) {
    return handleRouteError(err);
  }
}
