import { prisma } from "@/lib/prisma";
import { capsByBlock, type BlockCapSource } from "@/domain/sanatorium/daily-package-cap";
import { capBlockOfQuota } from "@/domain/sanatorium/package-assign-quota";
import { parseEntitlementSnapshot } from "@/domain/sanatorium/program-template-admin";

export type EpisodeDailyCaps = {
  caps: Map<string, number | null>;
  predecessorByQuota: Map<string, string>;
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
  return { caps: capsByBlock([...byCode.values()]), predecessorByQuota };
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
