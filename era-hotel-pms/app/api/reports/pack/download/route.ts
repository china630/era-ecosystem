import JSZip from 'jszip';
import { jsonError, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPackDefaults, getReportBySlug, validatePackSlugs } from '@/lib/reports/catalog';
import { parseReportLangParam } from '@/lib/reports/locale';
import { reportPdfT } from '@/lib/reports/pdf-i18n';
import { queryReport } from '@/lib/services/reports';
import { renderReportPdf } from '@/lib/services/reports/pdf-renderers';
import '@/lib/services/reports/register-p1-pdf';
import { prisma } from '@/lib/prisma';

interface PackConfig {
  enabled: boolean;
  slugs: string[];
}

async function resolvePackSlugs(): Promise<string[]> {
  const profile = await prisma.hotelProfile.findFirst({
    select: { policyJson: true },
  });

  if (profile?.policyJson) {
    try {
      const policy = JSON.parse(profile.policyJson);
      const pack = policy.nightAuditReportPack as PackConfig | undefined;
      if (pack && pack.enabled === false) return [];
      if (pack?.enabled && Array.isArray(pack.slugs)) return pack.slugs;
    } catch { /* use defaults */ }
  }

  return getPackDefaults().map((r) => r.slug);
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const url = new URL(request.url);
    const businessDate = url.searchParams.get('businessDate');
    if (!businessDate) return jsonError('Missing businessDate query param', 400);

    const lang = parseReportLangParam(request);
    if (!lang.ok) return jsonError(lang.message, 400);

    const slugs = await resolvePackSlugs();
    const pack = validatePackSlugs(slugs);
    if (!pack.ok) return jsonError(pack.message, 400);

    const profile = await prisma.hotelProfile.findFirst({ select: { name: true } });
    const propertyName = profile?.name ?? 'Hotel';
    const t = reportPdfT(lang.locale);
    const zip = new JSZip();
    let added = 0;

    for (let i = 0; i < pack.slugs.length; i++) {
      const slug = pack.slugs[i];
      const def = getReportBySlug(slug);
      if (!def) continue;
      try {
        const data = await queryReport(slug, businessDate, businessDate);
        const buf = await renderReportPdf(slug, data, {
          propertyName,
          locale: lang.locale,
          title: t(def.titleKey),
          subtitle: businessDate,
          t,
        });
        if (!buf) continue;
        const order = String(i + 1).padStart(2, '0');
        zip.file(`${order}_${slug}_${businessDate}.pdf`, buf);
        added += 1;
      } catch {
        continue;
      }
    }

    if (added === 0) return jsonError('ZIP pack has no enabled members', 400);

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

    return new Response(new Uint8Array(zipBuf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="nightly_pack_${businessDate}.zip"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
