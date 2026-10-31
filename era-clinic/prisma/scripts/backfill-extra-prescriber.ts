/**
 * Stamp the earliest episode care doctor onto paid extras that have no prescriber.
 * Usage: npx tsx prisma/scripts/backfill-extra-prescriber.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.procedureOrder.findMany({
    where: {
      inPackage: false,
      prescribedByPractitionerId: null,
      clinicalEpisodeId: { not: null },
    },
    select: { id: true, clinicalEpisodeId: true },
  });
  const episodeIds = [...new Set(orders.map((row) => row.clinicalEpisodeId).filter(Boolean))] as string[];
  const care = await prisma.episodeCareDoctor.findMany({
    where: { episodeId: { in: episodeIds } },
    orderBy: { assignedAt: "asc" },
    select: { episodeId: true, practitionerId: true },
  });
  const firstByEpisode = new Map<string, string>();
  for (const row of care) {
    if (!firstByEpisode.has(row.episodeId)) firstByEpisode.set(row.episodeId, row.practitionerId);
  }

  let updated = 0;
  let skipped = 0;
  for (const order of orders) {
    const practitionerId = order.clinicalEpisodeId
      ? firstByEpisode.get(order.clinicalEpisodeId)
      : undefined;
    if (!practitionerId) {
      skipped += 1;
      continue;
    }
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: { prescribedByPractitionerId: practitionerId },
    });
    updated += 1;
  }
  console.info(`extra prescriber backfill: updated ${updated}, skipped ${skipped} (no care doctor)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
