import { prisma } from "@/lib/prisma";

export type EpisodeStampInput = {
  patientRefId: string;
  reservationId?: string | null;
  /** Prefer this id when already known (e.g. intake for a specific episode). */
  clinicalEpisodeId?: string | null;
};

/**
 * Resolve OPEN episode for a patient (latest openedAt).
 * Optional reservationId narrows to that stay.
 */
export async function resolveOpenEpisode(
  patientRefId: string,
  reservationId?: string | null,
): Promise<{ id: string; status: string; anamnesisText: string | null } | null> {
  return prisma.clinicalEpisode.findFirst({
    where: {
      patientRefId,
      status: "OPEN",
      ...(reservationId ? { reservationId } : {}),
    },
    orderBy: { openedAt: "desc" },
    select: { id: true, status: true, anamnesisText: true },
  });
}

/**
 * Latest episode any status (for card default / print).
 */
export async function resolveLatestEpisode(patientRefId: string) {
  return prisma.clinicalEpisode.findFirst({
    where: { patientRefId },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      status: true,
      anamnesisText: true,
      programCode: true,
      openedAt: true,
      closedAt: true,
      roomNumber: true,
      patientOrigin: true,
    },
  });
}

/**
 * Stamp clinicalEpisodeId for create paths.
 * Prefer explicit id → OPEN by reservation → OPEN for patient → null (Pattern B / orphans).
 */
export async function stampEpisodeOnCreate(
  input: EpisodeStampInput,
): Promise<string | null> {
  if (input.clinicalEpisodeId) return input.clinicalEpisodeId;
  const open = await resolveOpenEpisode(
    input.patientRefId,
    input.reservationId ?? undefined,
  );
  if (open) return open.id;
  if (input.reservationId) {
    const byPatient = await resolveOpenEpisode(input.patientRefId);
    return byPatient?.id ?? null;
  }
  return null;
}
