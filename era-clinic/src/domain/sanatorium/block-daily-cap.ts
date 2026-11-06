import { prisma } from "@/lib/prisma";
import { capsByBlock, type BlockCapSource } from "@/domain/sanatorium/daily-package-cap";
import { capBlockOfQuota } from "@/domain/sanatorium/package-assign-quota";
import { parseEntitlementSnapshot } from "@/domain/sanatorium/program-template-admin";

export type EpisodeDailyCaps = {
  caps: Map<string, number | null>;
  /** DAILY_RATE unit cap per Baku day (sessions), keyed by block code. */
  useCaps: Map<string, number | null>;
  predecessorByQuota: Map<string, string>;
  /** Procedure SKU → package block whose daily cap it shares. */
  blockByProcedure: Map<string, string>;
};

type CapRow = BlockCapSource & { dailyUseCap?: number | null };

export async function loadEpisodeDailyCaps(episodeId: string): Promise<EpisodeDailyCaps> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: {
      programInstance: {
        select: {
          entitlementSnapshot: true,
          template: {
            select: {
              procedures: {
                select: {
                  procedureCode: true,
                  kind: true,
                  dailyDistinctCap: true,
                  dailyUseCap: true,
                },
              },
              blockMembers: { select: { blockCode: true, procedureCode: true } },
            },
          },
          quotaTransfers: { select: { fromCode: true, toQuotaCode: true, createdAt: true } },
        },
      },
    },
  });
  const templateRows: CapRow[] = episode?.programInstance?.template?.procedures ?? [];
  const snap = parseEntitlementSnapshot(episode?.programInstance?.entitlementSnapshot);
  const snapRows: CapRow[] = (snap?.procedures ?? []).map((row) => ({
    procedureCode: row.procedureCode,
    kind: row.kind,
    dailyDistinctCap: row.dailyDistinctCap,
    dailyUseCap: row.dailyUseCap,
  }));
  const byCode = new Map<string, CapRow>();
  for (const row of templateRows) byCode.set(row.procedureCode, row);
  for (const row of snapRows) {
    const prior = byCode.get(row.procedureCode);
    byCode.set(row.procedureCode, {
      procedureCode: row.procedureCode,
      kind: row.kind ?? prior?.kind,
      dailyDistinctCap: row.dailyDistinctCap ?? prior?.dailyDistinctCap,
      dailyUseCap: row.dailyUseCap ?? prior?.dailyUseCap ?? null,
    });
  }
  const predecessorByQuota = new Map<string, string>();
  const transfers = [...(episode?.programInstance?.quotaTransfers ?? [])].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  for (const row of transfers) predecessorByQuota.set(row.toQuotaCode, row.fromCode);
  const blockByProcedure = new Map<string, string>();
  for (const member of episode?.programInstance?.template?.blockMembers ?? []) {
    blockByProcedure.set(member.procedureCode, member.blockCode);
  }
  const useCaps = new Map<string, number | null>();
  for (const row of byCode.values()) {
    useCaps.set(
      row.procedureCode,
      row.dailyUseCap != null && Number.isFinite(Number(row.dailyUseCap))
        ? Math.max(1, Math.floor(Number(row.dailyUseCap)))
        : null,
    );
  }
  return {
    caps: capsByBlock([...byCode.values()]),
    useCaps,
    predecessorByQuota,
    blockByProcedure,
  };
}

/**
 * Package lines spend their block's daily cap. A paid extra does not, even when its SKU
 * is also listed on the package block. The same procedure code still cannot repeat that day.
 */
export function quotaForGuestDay(
  loaded: EpisodeDailyCaps | null,
  input: { inPackage: boolean; packageQuotaCode?: string | null; procedureCode: string },
): {
  quotaKey: string;
  dailyCap: number | null;
  dailyUseCap: number | null;
  shareGuestDayCap: boolean;
} {
  if (!loaded || !input.inPackage) {
    return {
      quotaKey: input.procedureCode,
      dailyCap: null,
      dailyUseCap: null,
      shareGuestDayCap: false,
    };
  }
  const cap = dailyCapForQuota(loaded, input.packageQuotaCode, input.procedureCode);
  return {
    quotaKey: cap.quotaKey,
    dailyCap: cap.dailyCap,
    dailyUseCap: cap.dailyUseCap,
    shareGuestDayCap: false,
  };
}

export function dailyCapForQuota(
  loaded: EpisodeDailyCaps,
  packageQuotaCode: string | null | undefined,
  procedureCode: string,
): { quotaKey: string; dailyCap: number | null; dailyUseCap: number | null } {
  const quota = (packageQuotaCode || procedureCode).trim();
  const quotaKey = capBlockOfQuota(quota, loaded.predecessorByQuota);
  const dailyCap = loaded.caps.has(quotaKey) ? (loaded.caps.get(quotaKey) ?? null) : null;
  const dailyUseCap = loaded.useCaps.has(quotaKey)
    ? (loaded.useCaps.get(quotaKey) ?? null)
    : null;
  return { quotaKey, dailyCap, dailyUseCap };
}
