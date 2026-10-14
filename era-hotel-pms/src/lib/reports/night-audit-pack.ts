import { prisma } from '@/lib/prisma';
import { getPackDefaults, upgradeLegacyNightAuditPack } from '@/lib/reports/catalog';

interface PackConfig {
  enabled?: boolean;
  slugs?: string[];
}

/**
 * Slugs for the nightly ZIP. A hotel profile that still stores the old eight-file
 * pack is rewritten to include the police list.
 */
export async function resolveNightAuditPackSlugs(): Promise<string[]> {
  const defaults = getPackDefaults().map((r) => r.slug);
  const profile = await prisma.hotelProfile.findFirst({
    select: { id: true, policyJson: true },
  });
  if (!profile?.policyJson) return defaults;

  let policy: Record<string, unknown>;
  try {
    policy = JSON.parse(profile.policyJson) as Record<string, unknown>;
  } catch {
    return defaults;
  }

  const pack = policy.nightAuditReportPack as PackConfig | undefined;
  if (pack && pack.enabled === false) return [];
  if (!pack?.enabled || !Array.isArray(pack.slugs) || pack.slugs.length === 0) return defaults;

  const upgraded = upgradeLegacyNightAuditPack(pack.slugs);
  if (upgraded.changed) {
    await prisma.hotelProfile.update({
      where: { id: profile.id },
      data: {
        policyJson: JSON.stringify({
          ...policy,
          nightAuditReportPack: { enabled: true, slugs: upgraded.slugs },
        }),
      },
    });
  }
  return upgraded.slugs;
}
