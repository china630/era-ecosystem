import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { resolveNightAuditPackSlugs } from '@/lib/reports/night-audit-pack';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const url = new URL(request.url);
    const businessDate = url.searchParams.get('businessDate');
    if (!businessDate) return jsonError('Missing businessDate query param', 400);

    const slugs = await resolveNightAuditPackSlugs();
    const reports = slugs
      .map((slug, i) => {
        const def = getReportBySlug(slug);
        return def ? { slug, titleKey: def.titleKey, packOrder: i + 1 } : null;
      })
      .filter(Boolean);

    return jsonOk({ businessDate, reports });
  } catch (err) {
    return handleRouteError(err);
  }
}
