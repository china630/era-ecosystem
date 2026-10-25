import { prisma } from "@/lib/prisma";
import { capsByBlock, type BlockCapSource } from "@/domain/sanatorium/daily-package-cap";
import { capBlockOfQuota } from "@/domain/sanatorium/package-assign-quota";
import { parseEntitlementSnapshot } from "@/domain/sanatorium/program-template-admin";

export type EpisodeDailyCaps = {
  caps: Map<string, number | null>;
  predecessorByQuota: Map<string, string>;
  /** Procedure SKU → package block whose daily cap it shares. */
  blockByProcedure: Map<string, string>;
};

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
                select: { procedureCode: true, kind: true, dailyDistinctCap: true },
              },
              blockMembers: { select: { blockCode: true, procedureCode: true } },
            },
          },
          quotaTransfers: { select: { fromCode: true, toQuotaCode: true, createdAt: true } },
        },
      },
    },
  });
  const templateRows: BlockCapSource[] = episode?.programInstance?.template?.procedures ?? [];
  const snap = parseEntitlementSnapshot(episode?.programInstance?.entitlementSnapshot);
  const snapRows: BlockCapSource[] = (snap?.procedures ?? []).map((row) => ({
    procedureCode: row.procedureCode,
    kind: row.kind,
    dailyDistinctCap: row.dailyDistinctCap,
  }));
  const byCode = new Map<string, BlockCapSource>();
  for (const row of templateRows) byCode.set(row.procedureCode, row);
  for (const row of snapRows) {
    const prior = byCode.get(row.procedureCode);
    byCode.set(row.procedureCode, {
      procedureCode: row.procedureCode,
      kind: row.kind ?? prior?.kind,
      dailyDistinctCap: row.dailyDistinctCap ?? prior?.dailyDistinctCap,
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
  return { caps: capsByBlock([...byCode.values()]), predecessorByQuota, blockByProcedure };
}

/**
 * Package lines spend their quota line. A paid extra spends the block that lists its SKU,
 * so it shares that block's daily distinct cap with the package.
 */
export function quotaForGuestDay(
  loaded: EpisodeDailyCaps | null,
  input: { inPackage: boolean; packageQuotaCode?: string | null; procedureCode: string },
): { quotaKey: string; dailyCap: number | null; shareGuestDayCap: boolean } {
  if (!loaded) {
    return { quotaKey: input.procedureCode, dailyCap: null, shareGuestDayCap: false };
  }
  if (input.inPackage) {
    const cap = dailyCapForQuota(loaded, input.packageQuotaCode, input.procedureCode);
    return { quotaKey: cap.quotaKey, dailyCap: cap.dailyCap, shareGuestDayCap: false };
  }
  const block = loaded.blockByProcedure.get(input.procedureCode);
  if (block && loaded.caps.has(block)) {
    const dailyCap = loaded.caps.get(block) ?? null;
    return { quotaKey: block, dailyCap, shareGuestDayCap: dailyCap != null };
  }
  return { quotaKey: input.procedureCode, dailyCap: null, shareGuestDayCap: false };
}

export function dailyCapForQuota(
  loaded: EpisodeDailyCaps,
  packageQuotaCode: string | null | undefined,
  procedureCode: string,
): { quotaKey: string; dailyCap: number | null } {
  const quota = (packageQuotaCode || procedureCode).trim();
  const quotaKey = capBlockOfQuota(quota, loaded.predecessorByQuota);
  const dailyCap = loaded.caps.has(quotaKey) ? (loaded.caps.get(quotaKey) ?? null) : null;
  return { quotaKey, dailyCap };
}
