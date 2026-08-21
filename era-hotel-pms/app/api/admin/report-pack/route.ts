import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { REPORT_CATALOG } from '@/lib/reports/catalog';

const DEFAULT_NAFTA_SLUGS = [
  'daily-management',
  'trial-balance-period',
  'cash-report',
  'monthly-daily-analysis',
  'in-house',
  'annual-occupancy',
  'folio-transactions',
  'department-revenues',
] as const;

function allowedSlugsSet(): Set<string> {
  return new Set(REPORT_CATALOG.map((r) => r.slug));
}

function uniquePreserveOrder(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function tryParsePolicyJson(raw: string | null | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

const putSchema = z.object({
  enabled: z.boolean().optional(),
  slugs: z.array(z.string()).optional(),
  reportIds: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);

    const profile = await prisma.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!profile) throw new Error('Hotel profile not found');

    const policy = tryParsePolicyJson(profile.policyJson);
    const pack = (policy as any)?.nightAuditReportPack;

    const allowed = allowedSlugsSet();

    const rawEnabled = typeof pack?.enabled === 'boolean' ? (pack.enabled as boolean) : true;
    const rawSlugs = Array.isArray(pack?.slugs) ? (pack.slugs as string[]) : [...DEFAULT_NAFTA_SLUGS];

    const nextSlugs = uniquePreserveOrder(rawSlugs);
    const unknown = nextSlugs.find((s) => !allowed.has(s));
    if (unknown) {
      return jsonOk(serialize({ enabled: true, slugs: [...DEFAULT_NAFTA_SLUGS], reportIds: [...DEFAULT_NAFTA_SLUGS] }));
    }

    const enabled = rawEnabled && nextSlugs.length > 0;
    const slugs = enabled ? nextSlugs : [];

    return jsonOk(serialize({ enabled, slugs, reportIds: slugs }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);

    const body = putSchema.parse(await request.json());
    const allowed = allowedSlugsSet();

    const rawSlugs = body.slugs ?? body.reportIds ?? [];
    const slugsUnique = uniquePreserveOrder(rawSlugs);

    const unknown = slugsUnique.find((s) => !allowed.has(s));
    if (unknown) throw new Error(`Unknown report slug: ${unknown}`);

    const enabled = body.enabled ?? slugsUnique.length > 0;
    const nextSlugs = enabled ? slugsUnique : [];

    const profile = await prisma.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!profile) throw new Error('Hotel profile not found');

    const policy = tryParsePolicyJson(profile.policyJson);
    const nextPolicy = {
      ...(policy as Record<string, unknown>),
      nightAuditReportPack: {
        enabled,
        slugs: nextSlugs,
      },
    };

    await prisma.hotelProfile.update({
      where: { id: profile.id },
      data: {
        policyJson: JSON.stringify(nextPolicy),
      },
    });

    return jsonOk(serialize({ enabled, slugs: nextSlugs, reportIds: nextSlugs }));
  } catch (err) {
    return handleRouteError(err);
  }
}

