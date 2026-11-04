import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import { prisma } from "@/lib/prisma";

/**
 * One paid lab per flagged service when the episode opens.
 * Package quota does not make it free. A missing price does not block the episode.
 * An open order is left alone. A cancelled one is created again.
 */
export async function seedAutoPaidLabs(episodeId: string): Promise<void> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      patientRefId: true,
      patientOrigin: true,
      reservationId: true,
      roomNumber: true,
    },
  });
  if (!episode?.patientRefId || episode.status !== "OPEN") return;

  const services = await prisma.diagnosticService.findMany({
    where: {
      organizationId: episode.organizationId,
      active: true,
      autoPaidOnOpen: true,
      kind: "lab_panel",
    },
    select: { code: true },
  });
  if (services.length === 0) {
    if (episode) {
      await prisma.clinicalEpisode.update({
        where: { id: episodeId },
        data: { autoPaidLabMisses: null },
      });
    }
    return;
  }

  const misses: string[] = [];
  for (const service of services) {
    try {
      await createLabOrderWithItems({
        patientRefId: episode.patientRefId,
        clinicalEpisodeId: episode.id,
        codes: [service.code],
        source: "IN_HOUSE",
        fasting: false,
        confirmRepeat: true,
        forcePaid: true,
        autoPaidStay: true,
        patientOrigin: episode.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE",
        reservationId: episode.reservationId,
        roomNumber: episode.roomNumber,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "LAB_ALREADY_OPEN") continue;
      if (code === "NO_PRICE") {
        misses.push(service.code);
        continue;
      }
      console.warn("[auto-paid-lab] skipped", service.code, err);
    }
  }

  await prisma.clinicalEpisode.update({
    where: { id: episodeId },
    data: { autoPaidLabMisses: misses.length > 0 ? misses.join(", ") : null },
  });
}
