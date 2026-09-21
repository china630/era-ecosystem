import { prisma } from "@/lib/prisma";
import {
  parseEntitlementSnapshot,
  resolveMembersByBlock,
} from "@/domain/sanatorium/program-template-admin";

/** ProcedureOrder statuses that count toward package quota. */
export const PROCEDURE_ENTITLEMENT_STATUSES = [
  "SCHEDULED",
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
] as const;

/** LabOrder statuses that count toward package quota (via LabOrderItem). */
export const LAB_ENTITLEMENT_STATUSES = [
  "ORDERED",
  "COLLECTED",
  "IN_PROGRESS",
  "RESULT_READY",
  "PUBLISHED",
  "COMPLETED",
] as const;

/** Visit statuses that count toward package quota (via VisitServiceLine). */
export const VISIT_ENTITLEMENT_STATUSES = ["IN_PROGRESS", "COMPLETED"] as const;

export async function resolveEntitlementInstance(episodeId: string) {
  return prisma.programInstance.findFirst({
    where: { episodeId },
    include: { procedureLines: true },
  });
}

/**
 * Map a real service/procedure SKU to the balance line it burns.
 * Prefers an exact balance row; else a block whose membership whitelist contains the SKU.
 */
export function resolveQuotaCodeForServiceCode(input: {
  balanceCodes: string[];
  membersByBlock: Map<string, string[]>;
  serviceCode: string;
}): string | null {
  const code = input.serviceCode.trim();
  if (!code) return null;
  if (input.balanceCodes.includes(code)) return code;
  for (const [blockCode, members] of input.membersByBlock) {
    if (!input.balanceCodes.includes(blockCode)) continue;
    if (members.some((m) => m === code)) return blockCode;
  }
  return null;
}

export async function membersByBlockForInstance(instance: {
  entitlementSnapshot: unknown;
  id: string;
}): Promise<Map<string, string[]>> {
  const snap = parseEntitlementSnapshot(instance.entitlementSnapshot);
  if (snap) {
    return resolveMembersByBlock({
      entitlementSnapshot: snap,
      templateMembers: [],
    });
  }
  const members = await prisma.programTemplateBlockMember.findMany({
    where: {
      template: { instances: { some: { id: instance.id } } },
    },
    select: { blockCode: true, procedureCode: true },
  });
  return resolveMembersByBlock({
    entitlementSnapshot: null,
    templateMembers: members,
  });
}

/**
 * Count in-package fulfillments that burn `quotaCode` across ProcedureOrder,
 * LabOrderItem, and VisitServiceLine. CANCELLED never counts.
 */
export async function countEntitlementUsage(input: {
  episodeId: string;
  quotaCode: string;
}): Promise<number> {
  const { episodeId, quotaCode } = input;
  const [procCount, labCount, visitCount] = await Promise.all([
    prisma.procedureOrder.count({
      where: {
        clinicalEpisodeId: episodeId,
        inPackage: true,
        status: { in: [...PROCEDURE_ENTITLEMENT_STATUSES] },
        OR: [
          { packageQuotaCode: quotaCode },
          { packageQuotaCode: null, procedureCode: quotaCode },
        ],
      },
    }),
    prisma.labOrderItem.count({
      where: {
        inPackage: true,
        OR: [
          { packageQuotaCode: quotaCode },
          { packageQuotaCode: null, serviceCode: quotaCode },
        ],
        labOrder: {
          clinicalEpisodeId: episodeId,
          status: { in: [...LAB_ENTITLEMENT_STATUSES] },
        },
      },
    }),
    prisma.visitServiceLine.count({
      where: {
        inPackage: true,
        OR: [
          { packageQuotaCode: quotaCode },
          { packageQuotaCode: null, serviceCode: quotaCode },
        ],
        visit: {
          clinicalEpisodeId: episodeId,
          status: { in: [...VISIT_ENTITLEMENT_STATUSES] },
        },
      },
    }),
  ]);
  return procCount + labCount + visitCount;
}

/** Overwrite balance.quotaUsed from the single COUNT source of truth. */
export async function syncEntitlementUsage(input: {
  instanceId: string;
  episodeId: string;
  quotaCode: string;
}): Promise<number> {
  const used = await countEntitlementUsage({
    episodeId: input.episodeId,
    quotaCode: input.quotaCode,
  });
  await prisma.programProcedureBalance.updateMany({
    where: { instanceId: input.instanceId, procedureCode: input.quotaCode },
    data: { quotaUsed: used },
  });
  return used;
}

/** Sync every balance line on an instance (e.g. after endsOn shrink / package drop). */
export async function syncAllEntitlementUsage(input: {
  instanceId: string;
  episodeId: string;
}): Promise<void> {
  const lines = await prisma.programProcedureBalance.findMany({
    where: { instanceId: input.instanceId },
    select: { procedureCode: true },
  });
  for (const line of lines) {
    await syncEntitlementUsage({
      instanceId: input.instanceId,
      episodeId: input.episodeId,
      quotaCode: line.procedureCode,
    });
  }
}

/**
 * Read-only over-quota check. Does NOT increment quotaUsed.
 * Prefer packageQuotaCode when present (pool burns).
 */
export async function isOverEntitlementQuota(input: {
  instanceId: string;
  quotaCode: string;
}): Promise<{ hasBalance: boolean; overQuota: boolean; remaining: number }> {
  const line = await prisma.programProcedureBalance.findUnique({
    where: {
      instanceId_procedureCode: {
        instanceId: input.instanceId,
        procedureCode: input.quotaCode,
      },
    },
  });
  if (!line) return { hasBalance: false, overQuota: false, remaining: 0 };
  const remaining = Math.max(0, line.quotaTotal - line.quotaUsed);
  return {
    hasBalance: true,
    overQuota: line.quotaUsed >= line.quotaTotal,
    remaining,
  };
}

/**
 * Stamp inPackage + packageQuotaCode for a service if the episode has a matching balance.
 * Returns null when no entitlement applies (caller keeps amount logic separate).
 */
export async function resolvePackageStampForEpisode(input: {
  episodeId: string;
  serviceCode: string;
}): Promise<{ inPackage: true; packageQuotaCode: string } | null> {
  const instance = await resolveEntitlementInstance(input.episodeId);
  if (!instance) return null;
  const membersByBlock = await membersByBlockForInstance(instance);
  const quotaCode = resolveQuotaCodeForServiceCode({
    balanceCodes: instance.procedureLines.map((l) => l.procedureCode),
    membersByBlock,
    serviceCode: input.serviceCode,
  });
  if (!quotaCode) return null;
  return { inPackage: true, packageQuotaCode: quotaCode };
}
