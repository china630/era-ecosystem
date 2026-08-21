import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPackDefaults, getReportBySlug } from '@/lib/reports/catalog';
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
      if (pack?.enabled && Array.isArray(pack.slugs) && pack.slugs.length > 0) {
        return pack.slugs;
      }
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

    const slugs = await resolvePackSlugs();
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
