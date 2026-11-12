import { prisma } from "@/lib/prisma";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Package blood panels stay in-house. The own-blank date is the infection panel. */
export const PACKAGE_BLOOD_BIOCHEM_CODES = new Set([
  "LAB-BIOCHEM-STANDART",
  "LAB-BIOCHEM-PREMIUM",
  "LAB-BIOCHEM-DERMA",
  "LAB-BIOCHEM-DETOKS",
]);

export function ownBlankMaxDays(code: string, days: number | null | undefined): number | null {
  if (days == null || PACKAGE_BLOOD_BIOCHEM_CODES.has(code)) return null;
  return days;
}

export function broughtInAgeDays(resultOnYmd: string, todayYmd = todayBakuYmd()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resultOnYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) {
    return null;
  }
  const result = bakuDayBounds(resultOnYmd).start.getTime();
  const today = bakuDayBounds(todayYmd).start.getTime();
  return Math.round((today - result) / DAY_MS);
}

export function broughtInIsFresh(resultOnYmd: string, maxDays: number, todayYmd = todayBakuYmd()): boolean {
  const age = broughtInAgeDays(resultOnYmd, todayYmd);
  return age != null && age >= 0 && age <= maxDays;
}

export async function freshBroughtInCodes(episodeId: string): Promise<Set<string>> {
  const rows = await prisma.episodeBroughtInResult.findMany({
    where: { episodeId },
    select: { serviceCode: true, resultOn: true },
  });
  if (rows.length === 0) return new Set();
  const services = await prisma.diagnosticService.findMany({
    where: {
      broughtInMaxDays: { not: null },
      OR: [
        { code: { in: rows.map((row) => row.serviceCode) } },
        { serviceCode: { in: rows.map((row) => row.serviceCode) } },
      ],
    },
    select: { code: true, serviceCode: true, broughtInMaxDays: true },
  });
  const maxByCode = new Map<string, number>();
  for (const service of services) {
    const days = ownBlankMaxDays(service.code, service.broughtInMaxDays);
    if (days == null) continue;
    maxByCode.set(service.code, days);
    const viaSku = ownBlankMaxDays(service.serviceCode, service.broughtInMaxDays);
    if (viaSku != null) maxByCode.set(service.serviceCode, viaSku);
  }
  const fresh = new Set<string>();
  for (const row of rows) {
    const maxDays = maxByCode.get(row.serviceCode);
    if (maxDays == null) continue;
    const ymd = row.resultOn.toISOString().slice(0, 10);
    if (!broughtInIsFresh(ymd, maxDays)) continue;
    fresh.add(row.serviceCode);
    for (const service of services) {
      if (service.code !== row.serviceCode && service.serviceCode !== row.serviceCode) continue;
      fresh.add(service.code);
      if (service.serviceCode) fresh.add(service.serviceCode);
    }
  }
  return fresh;
}

type BroughtInEpisodeContext = {
  id: string;
  organizationId: string;
  programInstance: { templateId: string } | null;
};

async function resolveBroughtInDiagnosticService(
  episode: BroughtInEpisodeContext,
  serviceCode: string,
) {
  let service = await prisma.diagnosticService.findFirst({
    where: {
      organizationId: episode.organizationId,
      active: true,
      broughtInMaxDays: { not: null },
      OR: [{ code: serviceCode }, { serviceCode }],
    },
    select: { code: true, serviceCode: true, broughtInMaxDays: true },
  });
  if (!service && episode.programInstance) {
    const links = await prisma.programTemplateBlockMember.findMany({
      where: {
        organizationId: episode.organizationId,
        templateId: episode.programInstance.templateId,
        blockCode: serviceCode,
      },
      select: { procedureCode: true },
    });
    const skus = [...new Set(links.map((link) => link.procedureCode))];
    if (skus.length === 1) {
      service = await prisma.diagnosticService.findFirst({
        where: {
          organizationId: episode.organizationId,
          active: true,
          broughtInMaxDays: { not: null },
          OR: [{ code: skus[0] }, { serviceCode: skus[0] }],
        },
        select: { code: true, serviceCode: true, broughtInMaxDays: true },
      });
    }
  }
  return service;
}

export type ApplyEpisodeBroughtInBlankResult =
  | { ok: true; serviceCode: string; resultOn: string | null }
  | { ok: false; kind: "EPISODE_NOT_FOUND" | "NOT_ACCEPTED" | "STALE" };

/**
 * Persists or clears a brought-in blank for an episode, cancelling open lab orders when set.
 */
export async function applyEpisodeBroughtInBlank(input: {
  episodeId: string;
  serviceCode: string;
  resultOn: string | null;
  cancelOpenOrdersUserId: string;
}): Promise<ApplyEpisodeBroughtInBlankResult> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: input.episodeId },
    select: {
      id: true,
      organizationId: true,
      programInstance: { select: { templateId: true } },
    },
  });
  if (!episode) return { ok: false, kind: "EPISODE_NOT_FOUND" };

  const service = await resolveBroughtInDiagnosticService(episode, input.serviceCode);
  const maxDays = service ? ownBlankMaxDays(service.code, service.broughtInMaxDays) : null;
  if (!service || maxDays == null) return { ok: false, kind: "NOT_ACCEPTED" };

  if (!input.resultOn) {
    await prisma.episodeBroughtInResult.deleteMany({
      where: { episodeId: input.episodeId, serviceCode: service.code },
    });
    return { ok: true, serviceCode: service.code, resultOn: null };
  }
  if (!broughtInIsFresh(input.resultOn, maxDays)) {
    return { ok: false, kind: "STALE" };
  }

  const { requestOrganizationId } = await import("@/lib/request-organization");
  const orgId = episode.organizationId || requestOrganizationId();
  await prisma.episodeBroughtInResult.upsert({
    where: {
      episodeId_serviceCode: { episodeId: input.episodeId, serviceCode: service.code },
    },
    create: {
      organizationId: orgId,
      episodeId: input.episodeId,
      serviceCode: service.code,
      resultOn: new Date(`${input.resultOn}T00:00:00.000Z`),
    },
    update: { resultOn: new Date(`${input.resultOn}T00:00:00.000Z`) },
  });

  const codes = new Set<string>([service.code, service.serviceCode].filter(Boolean));
  if (episode.programInstance) {
    const blocks = await prisma.programTemplateBlockMember.findMany({
      where: {
        organizationId: episode.organizationId,
        templateId: episode.programInstance.templateId,
        procedureCode: { in: [...codes] },
      },
      select: { blockCode: true },
    });
    for (const block of blocks) codes.add(block.blockCode);
  }
  const codeList = [...codes];
  const openOrders = await prisma.labOrder.findMany({
    where: {
      clinicalEpisodeId: input.episodeId,
      status: "ORDERED",
      OR: [
        { testCode: { in: codeList } },
        { items: { some: { serviceCode: { in: codeList } } } },
      ],
    },
    select: { id: true },
  });
  const { cancelLabOrder } = await import("@/domain/lab/lab-order-cancel.service");
  for (const order of openOrders) {
    await cancelLabOrder(order.id, {
      userId: input.cancelOpenOrdersUserId,
      reason: "brought_in_blank",
    });
  }

  return { ok: true, serviceCode: service.code, resultOn: input.resultOn };
}
