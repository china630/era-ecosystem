import { prisma } from "@/lib/prisma";
import { instantiateProgramFromTemplate } from "@/lib/sanatorium-scheduler.service";
import { episodeAnamnesisDenied } from "@/domain/sanatorium/episode-gates";
import { episodeCareTeamDenied } from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";

export type Day1ProgramResult =
  | { opened: true; programCode: string }
  | {
      opened: false;
      reason:
        | "ALREADY_OPEN"
        | "NO_ANAMNESIS"
        | "NO_COMPLAINT"
        | "NO_PROGRAM_CODE"
        | "NO_CARE_TEAM"
        | "NOT_OPEN"
        | "NOT_FOUND"
        | "INSTANTIATE_FAILED";
    };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Day-1 package open — **anamnesis AND ≥1 complaint** (both required).
 * Labs / ICD not required. Concurrent twin calls → ALREADY_OPEN via unique(episodeId).
 */
export async function tryOpenProgramAfterTherapistStage(
  episodeId: string,
): Promise<Day1ProgramResult> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: {
      complaints: { select: { id: true }, take: 1 },
      programInstance: { select: { id: true } },
    },
  });
  if (!episode) return { opened: false, reason: "NOT_FOUND" };
  if (episode.status !== "OPEN") return { opened: false, reason: "NOT_OPEN" };
  if (episode.programInstance) return { opened: false, reason: "ALREADY_OPEN" };

  // Strict AND — no OR between anamnesis and complaint.
  if (episodeAnamnesisDenied(episode.anamnesisText)) {
    return { opened: false, reason: "NO_ANAMNESIS" };
  }
  if (episode.complaints.length === 0) {
    return { opened: false, reason: "NO_COMPLAINT" };
  }

  const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episodeId));
  if (careDenied) return { opened: false, reason: "NO_CARE_TEAM" };

  const programCode = episode.programCode?.trim();
  if (!programCode) return { opened: false, reason: "NO_PROGRAM_CODE" };

  try {
    await instantiateProgramFromTemplate({
      episodeId,
      programCode,
      reservationId: episode.reservationId ?? undefined,
      startsOn: new Date(),
    });
    await prisma.clinicalEpisode.update({
      where: { id: episodeId },
      data: { checkupCompletedAt: new Date(), programCode },
    });
    return { opened: true, programCode };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { opened: false, reason: "ALREADY_OPEN" };
    }
    console.error("[day1] tryOpenProgramAfterTherapistStage", episodeId, err);
    return { opened: false, reason: "INSTANTIATE_FAILED" };
  }
}
