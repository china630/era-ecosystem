import type { HotelSellablePackageFamily, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

export type SellablePackageRow = {
  id: string;
  code: string;
  name: string;
  family: HotelSellablePackageFamily;
  active: boolean;
  ratePlanId: string | null;
  minNights: number | null;
  maxNights: number | null;
  durationDays: number | null;
  sortOrder: number;
};

function inferFamily(code: string): HotelSellablePackageFamily {
  return /INFOTUR/i.test(code) ? 'INFOTUR' : 'MEDICAL';
}

export async function listSellablePackages(filters?: {
  family?: HotelSellablePackageFamily;
  activeOnly?: boolean;
}): Promise<SellablePackageRow[]> {
  const where: Prisma.HotelSellablePackageWhereInput = {};
  if (filters?.family) where.family = filters.family;
  if (filters?.activeOnly) where.active = true;
  return prisma.hotelSellablePackage.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
}

export async function listActiveMedicalPackageChoices(): Promise<
  Array<{ value: string; label: string; minNights: number | null; maxNights: number | null }>
> {
  const rows = await listSellablePackages({ family: 'MEDICAL', activeOnly: true });
  return rows.map((r) => ({
    value: r.code,
    label: r.name || r.code,
    minNights: r.minNights,
    maxNights: r.maxNights,
  }));
}

export async function countActiveMedicalPackages(): Promise<number> {
  return prisma.hotelSellablePackage.count({
    where: { family: 'MEDICAL', active: true },
  });
}

export async function findSellablePackageByCode(code: string | null | undefined) {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return null;
  return prisma.hotelSellablePackage.findFirst({
    where: { code: c },
  });
}

export async function acceptCatalogPackageCode(
  raw: string | null | undefined,
): Promise<string | null> {
  const c = (raw ?? '').trim().toUpperCase();
  if (!c) return null;
  const row = await prisma.hotelSellablePackage.findFirst({
    where: { code: c, active: true, family: 'MEDICAL' },
    select: { code: true },
  });
  return row?.code ?? null;
}

export async function updateSellablePackage(
  id: string,
  data: Partial<{
    name: string;
    family: HotelSellablePackageFamily;
    active: boolean;
    ratePlanId: string | null;
    minNights: number | null;
    maxNights: number | null;
    durationDays: number | null;
    sortOrder: number;
  }>,
) {
  return prisma.hotelSellablePackage.update({ where: { id }, data });
}

type ClinicTemplate = {
  code: string;
  name: string;
  minNights: number | null;
  maxNights: number | null;
  durationDays: number | null;
};

/** Pull current clinic program templates into hotel catalog (upsert by code). */
export async function syncSellablePackagesFromClinic(): Promise<{
  upserted: number;
  templates: number;
  clinicReached: boolean;
}> {
  const org = requestOrganizationId();
  const templates = await fetchClinicProgramTemplates(org);
  if (!templates) {
    return { upserted: 0, templates: 0, clinicReached: false };
  }

  let upserted = 0;
  for (const [index, t] of templates.entries()) {
    const code = t.code.trim().toUpperCase();
    if (!code) continue;
    const family = inferFamily(code);
    const ratePlan = await prisma.ratePlan.findFirst({
      where: { code, active: true },
      select: { id: true },
    });
    await prisma.hotelSellablePackage.upsert({
      where: { organizationId_code: { organizationId: org, code } },
      create: {
        organizationId: org,
        code,
        name: t.name || code,
        family,
        active: true,
        ratePlanId: ratePlan?.id ?? null,
        minNights: t.minNights,
        maxNights: t.maxNights,
        durationDays: t.durationDays,
        sortOrder: index,
      },
      update: {
        name: t.name || code,
        family,
        ratePlanId: ratePlan?.id ?? undefined,
        minNights: t.minNights,
        maxNights: t.maxNights,
        durationDays: t.durationDays,
      },
    });
    upserted += 1;
  }
  return { upserted, templates: templates.length, clinicReached: true };
}

async function fetchClinicProgramTemplates(
  organizationId: string,
): Promise<ClinicTemplate[] | null> {
  const base = (process.env.CLINIC_INTERNAL_URL ?? process.env.CLINIC_URL ?? process.env.ERA_CLINIC_URL ?? '')
    .replace(/\/$/, '');
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? '';
  if (!base || !token) return null;
  const res = await fetch(
    `${base}/api/internal/v1/program-template-codes?organizationId=${encodeURIComponent(organizationId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    codes?: unknown;
    templates?: Array<{
      code?: unknown;
      name?: unknown;
      minNights?: unknown;
      maxNights?: unknown;
      durationDays?: unknown;
    }>;
  } | null;
  if (Array.isArray(body?.templates) && body!.templates.length > 0) {
    return body!
      .templates!.map((t) => ({
        code: String(t.code ?? '')
          .trim()
          .toUpperCase(),
        name: String(t.name ?? '').trim(),
        minNights: typeof t.minNights === 'number' ? t.minNights : null,
        maxNights: typeof t.maxNights === 'number' ? t.maxNights : null,
        durationDays: typeof t.durationDays === 'number' ? t.durationDays : null,
      }))
      .filter((t) => t.code);
  }
  const codes = Array.isArray(body?.codes) ? body!.codes : [];
  return codes
    .map((c) => String(c).trim().toUpperCase())
    .filter(Boolean)
    .map((code) => ({
      code,
      name: code,
      minNights: null,
      maxNights: null,
      durationDays: null,
    }));
}

/** Family for a rate plan code from catalog; INFOTUR/MEDICAL only when row exists. */
export async function catalogFamilyForCode(
  code: string | null | undefined,
): Promise<HotelSellablePackageFamily | null> {
  const row = await findSellablePackageByCode(code);
  return row?.family ?? null;
}
