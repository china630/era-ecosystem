import { jsonError, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReportBySlug } from '@/lib/reports/catalog';
import { parseReportLangParam } from '@/lib/reports/locale';
import { reportPdfT } from '@/lib/reports/pdf-i18n';
import { isImplementedReportSlug, queryReport } from '@/lib/services/reports';
import { renderReportPdf } from '@/lib/services/reports/pdf-renderers';
import '@/lib/services/reports/register-p1-pdf';
import { prisma } from '@/lib/prisma';

async function getPropertyName(): Promise<string> {
  const profile = await prisma.hotelProfile.findFirst({ select: { name: true } });
  return profile?.name ?? 'Hotel';
}

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
      return jsonError(`Report "${slug}" PDF not implemented`, 501);
    }

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return jsonError('Missing from/to query params', 400);

    const lang = parseReportLangParam(request);
    if (!lang.ok) return jsonError(lang.message, 400);

    const dim = url.searchParams.get('dim') ?? undefined;
    const data = await queryReport(slug, from, to, dim ? { dim } : undefined);
    const propertyName = await getPropertyName();

    const t = reportPdfT(lang.locale);
    const buffer = await renderReportPdf(slug, data, {
      propertyName,
      locale: lang.locale,
      title: t(def.titleKey),
      subtitle: `${from} — ${to}`,
      t,
    });
    if (!buffer) return jsonError(`PDF renderer not found for "${slug}"`, 501);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${slug}_${from}.pdf"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
