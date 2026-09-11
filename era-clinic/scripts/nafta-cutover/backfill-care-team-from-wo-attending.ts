/**
 * Backfill EpisodeCareDoctor from WO attending Visits (cutover entity attending-visits).
 * Prisma migration 20260902150000 does the same on migrate deploy; this script is for
 * dry-run / re-apply on a DB that already ran DDL without the data step.
 *
 *   npx tsx scripts/nafta-cutover/backfill-care-team-from-wo-attending.ts
 *   npx tsx scripts/nafta-cutover/backfill-care-team-from-wo-attending.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { CUTOVER_ATTENDING_VISIT_ENTITY } from "../../src/lib/import/cutover-attending-visit";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function resolveEpisodeId(visit: {
  clinicalEpisodeId: string | null;
  patientRefId: string;
  reservationId: string | null;
}): Promise<string | null> {
  if (visit.clinicalEpisodeId) return visit.clinicalEpisodeId;
  if (visit.reservationId) {
    const byRes = await prisma.clinicalEpisode.findFirst({
      where: {
        patientRefId: visit.patientRefId,
        reservationId: visit.reservationId,
      },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });
    if (byRes) return byRes.id;
  }
  const latest = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId: visit.patientRefId },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
  return latest?.id ?? null;
}

async function main() {
  const keys = await prisma.cutoverImportKey.findMany({
    where: { entity: CUTOVER_ATTENDING_VISIT_ENTITY },
    select: { recordId: true, externalRef: true, organizationId: true },
  });

  let planned = 0;
  let skippedNoVisit = 0;
  let skippedNoEpisode = 0;
  let already = 0;
  let linkedEpisode = 0;

  for (const key of keys) {
    const visit = await prisma.visit.findUnique({
      where: { id: key.recordId },
      select: {
        id: true,
        practitionerId: true,
        clinicalEpisodeId: true,
        patientRefId: true,
        reservationId: true,
        createdAt: true,
      },
    });
    if (!visit) {
      skippedNoVisit += 1;
      continue;
    }

    const episodeId = await resolveEpisodeId(visit);
    if (!episodeId) {
      skippedNoEpisode += 1;
      console.log(
        `${APPLY ? "SKIP" : "DRY"} no episode for ${key.externalRef} visit=${visit.id}`,
      );
      continue;
    }

    if (!visit.clinicalEpisodeId && APPLY) {
      await prisma.visit.update({
        where: { id: visit.id },
        data: { clinicalEpisodeId: episodeId },
      });
      linkedEpisode += 1;
    }

    const existing = await prisma.episodeCareDoctor.findUnique({
      where: {
        episodeId_practitionerId: {
          episodeId,
          practitionerId: visit.practitionerId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      already += 1;
      continue;
    }

    planned += 1;
    console.log(
      `${APPLY ? "APPLY" : "DRY"} ${key.externalRef} → episode=${episodeId} practitioner=${visit.practitionerId}`,
    );
    if (APPLY) {
      await prisma.episodeCareDoctor.create({
        data: {
          episodeId,
          practitionerId: visit.practitionerId,
          assignedAt: visit.createdAt,
          assignedByUserId: null,
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry",
        attendingKeys: keys.length,
        planned,
        already,
        skippedNoVisit,
        skippedNoEpisode,
        linkedEpisode,
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
  .finally(async () => {
    await prisma.$disconnect();
  });
