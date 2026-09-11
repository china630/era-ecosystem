#!/usr/bin/env node
/**
 * Backfill LabOrderItem / VisitServiceLine inPackage + packageQuotaCode
 * for OPEN episodes that already have a ProgramInstance.
 *
 * Usage:
 *   node --import tsx era-clinic/scripts/backfill-entitlement-usage.mjs [--dry-run]
 */
import { PrismaClient } from "@prisma/client";

const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

function membersMap(members) {
  const map = new Map();
  for (const m of members) {
    const arr = map.get(m.blockCode) ?? [];
    arr.push(m.procedureCode);
    map.set(m.blockCode, arr);
  }
  return map;
}

function resolveQuotaCode(balanceCodes, membersByBlock, serviceCode) {
  const code = String(serviceCode || "").trim();
  if (!code) return null;
  if (balanceCodes.includes(code)) return code;
  for (const [blockCode, members] of membersByBlock) {
    if (!balanceCodes.includes(blockCode)) continue;
    if (members.some((m) => m === code)) return blockCode;
  }
  return null;
}

async function main() {
  const instances = await prisma.programInstance.findMany({
    where: { episode: { status: "OPEN" } },
    include: {
      procedureLines: true,
      episode: { select: { id: true } },
      template: {
        include: {
          blockMembers: { select: { blockCode: true, procedureCode: true } },
        },
      },
    },
  });

  let stampedLab = 0;
  let stampedVisit = 0;
  let ambiguous = 0;
  const ambiguousRows = [];

  for (const inst of instances) {
    const episodeId = inst.episodeId;
    const balanceCodes = inst.procedureLines.map((l) => l.procedureCode);
    const snap = inst.entitlementSnapshot;
    let members = inst.template?.blockMembers ?? [];
    if (snap && typeof snap === "object" && Array.isArray(snap.members)) {
      members = snap.members;
    }
    const membersByBlock = membersMap(members);

    const labItems = await prisma.labOrderItem.findMany({
      where: {
        inPackage: false,
        packageQuotaCode: null,
        labOrder: {
          clinicalEpisodeId: episodeId,
          status: { not: "CANCELLED" },
        },
      },
      select: { id: true, serviceCode: true },
    });
    for (const item of labItems) {
      const quota = resolveQuotaCode(balanceCodes, membersByBlock, item.serviceCode);
      if (!quota) {
        ambiguous += 1;
        ambiguousRows.push({ kind: "lab", id: item.id, code: item.serviceCode, episodeId });
        continue;
      }
      if (!dryRun) {
        await prisma.labOrderItem.update({
          where: { id: item.id },
          data: { inPackage: true, packageQuotaCode: quota },
        });
      }
      stampedLab += 1;
    }

    const visitLines = await prisma.visitServiceLine.findMany({
      where: {
        inPackage: false,
        packageQuotaCode: null,
        visit: {
          clinicalEpisodeId: episodeId,
          status: { not: "CANCELLED" },
        },
      },
      select: { id: true, serviceCode: true },
    });
    for (const line of visitLines) {
      const quota = resolveQuotaCode(balanceCodes, membersByBlock, line.serviceCode);
      if (!quota) {
        ambiguous += 1;
        ambiguousRows.push({ kind: "visit", id: line.id, code: line.serviceCode, episodeId });
        continue;
      }
      if (!dryRun) {
        await prisma.visitServiceLine.update({
          where: { id: line.id },
          data: { inPackage: true, packageQuotaCode: quota },
        });
      }
      stampedVisit += 1;
    }

    // Resync all balance lines from COUNT
    if (!dryRun) {
      for (const line of inst.procedureLines) {
        const [procCount, labCount, visitCount] = await Promise.all([
          prisma.procedureOrder.count({
            where: {
              clinicalEpisodeId: episodeId,
              inPackage: true,
              status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
              OR: [
                { packageQuotaCode: line.procedureCode },
                { packageQuotaCode: null, procedureCode: line.procedureCode },
              ],
            },
          }),
          prisma.labOrderItem.count({
            where: {
              inPackage: true,
              OR: [
                { packageQuotaCode: line.procedureCode },
                { packageQuotaCode: null, serviceCode: line.procedureCode },
              ],
              labOrder: {
                clinicalEpisodeId: episodeId,
                status: {
                  in: [
                    "ORDERED",
                    "COLLECTED",
                    "IN_PROGRESS",
                    "RESULT_READY",
                    "PUBLISHED",
                    "COMPLETED",
                  ],
                },
              },
            },
          }),
          prisma.visitServiceLine.count({
            where: {
              inPackage: true,
              OR: [
                { packageQuotaCode: line.procedureCode },
                { packageQuotaCode: null, serviceCode: line.procedureCode },
              ],
              visit: {
                clinicalEpisodeId: episodeId,
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
              },
            },
          }),
        ]);
        await prisma.programProcedureBalance.update({
          where: { id: line.id },
          data: { quotaUsed: procCount + labCount + visitCount },
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        instances: instances.length,
        stampedLab,
        stampedVisit,
        ambiguous,
        ambiguousSample: ambiguousRows.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
