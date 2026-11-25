import { prisma } from "@/lib/prisma";

/** Prefer ProgramInstance.endsOn; fall back to plannedEndsOn (ambulatory). */
export function coalesceScheduleBefore(
  programEndsOn: Date | null | undefined,
  plannedEndsOn: Date | null | undefined,
): Date | null {
  return programEndsOn ?? plannedEndsOn ?? null;
}

/**
 * Exclusive schedule end for extras / OPEN pins / stay seat cap.
 * Prefer ProgramInstance.endsOn; fall back to episode.plannedEndsOn (ambulatory).
 */
export async function resolveEpisodeScheduleBefore(
  episodeId: string,
): Promise<Date | null> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: {
      plannedEndsOn: true,
      programInstance: { select: { endsOn: true } },
    },
  });
  if (!episode) return null;
  return coalesceScheduleBefore(episode.programInstance?.endsOn, episode.plannedEndsOn);
}
