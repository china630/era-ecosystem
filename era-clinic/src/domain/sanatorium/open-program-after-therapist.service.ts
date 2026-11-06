import { prisma } from "@/lib/prisma";
import { instantiateProgramFromTemplate } from "@/lib/sanatorium-scheduler.service";
import { linkExistingAutoOrdersToPackage } from "@/domain/sanatorium/package-auto-apply.service";
import { episodeAnamnesisDenied } from "@/domain/sanatorium/episode-gates";
import { episodeCareTeamDenied } from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";
import { QuotaBelowMinError } from "@/lib/program-quota";

export type Day1ProgramFailReason =
  | "ALREADY_OPEN"
  | "NO_ANAMNESIS"
  | "NO_COMPLAINT"
  | "NO_DIAGNOSIS"
  | "NO_PROGRAM_CODE"
  | "NO_CARE_TEAM"
  | "NOT_OPEN"
  | "NOT_FOUND"
  | "TEMPLATE_NOT_FOUND"
  | "PACKAGE_NIGHTS_BELOW_MIN"
  | "INSTANTIATE_FAILED";

export type Day1ProgramResult =
  | { opened: true; programCode: string }
  | {
      opened: false;
      reason: Day1ProgramFailReason;
      programCode?: string;
      nights?: number;
      minNights?: number;
    };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

function isTemplateMissing(err: unknown, programCode: string): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("not found") &&
    msg.includes("template") &&
    msg.includes(programCode.toLowerCase())
  );
}

/**
 * Day-1 package open — anamnesis AND ≥1 complaint AND ≥1 ICD-10 (all required).
 * Concurrent twin calls → ALREADY_OPEN via unique(episodeId).
 */
export async function tryOpenProgramAfterTherapistStage(
  episodeId: string,
): Promise<Day1ProgramResult> {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: {
      complaints: { select: { id: true }, take: 1 },
      diagnoses: { select: { id: true }, take: 1 },
      programInstance: { select: { id: true } },
    },
  });
  if (!episode) return { opened: false, reason: "NOT_FOUND" };
  if (episode.status !== "OPEN") return { opened: false, reason: "NOT_OPEN" };
  if (episode.programInstance) return { opened: false, reason: "ALREADY_OPEN" };

  if (episodeAnamnesisDenied(episode.anamnesisText)) {
    return { opened: false, reason: "NO_ANAMNESIS" };
  }
  if (episode.complaints.length === 0) {
    return { opened: false, reason: "NO_COMPLAINT" };
  }
  if (episode.diagnoses.length === 0) {
    return { opened: false, reason: "NO_DIAGNOSIS" };
  }

  const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episodeId));
  if (careDenied) return { opened: false, reason: "NO_CARE_TEAM" };

  const programCode = episode.programCode?.trim();
  if (!programCode) return { opened: false, reason: "NO_PROGRAM_CODE" };

  try {
    const { lookupHotelStayWindow } = await import("@/lib/hotel-stay-person");
    const { nightsBetween } = await import("@/lib/program-quota");
    const hotel = episode.reservationId
      ? await lookupHotelStayWindow(episode.reservationId)
      : null;
    const checkIn = hotel ? new Date(hotel.checkInDate) : new Date();
    const checkOut = hotel ? new Date(hotel.checkOutDate) : undefined;
    await instantiateProgramFromTemplate({
      episodeId,
      programCode,
      reservationId: episode.reservationId ?? undefined,
      startsOn: checkIn,
      checkInDate: hotel ? checkIn : undefined,
      checkOutDate: checkOut,
      nights: hotel && checkOut ? nightsBetween(checkIn, checkOut) || undefined : undefined,
    });
    await prisma.clinicalEpisode.update({
      where: { id: episodeId },
      data: { checkupCompletedAt: new Date(), programCode },
    });
    try {
      await linkExistingAutoOrdersToPackage(episodeId);
    } catch (linkErr) {
      console.error("[day1] link existing auto orders", episodeId, linkErr);
    }
    return { opened: true, programCode };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { opened: false, reason: "ALREADY_OPEN" };
    }
    if (err instanceof QuotaBelowMinError) {
      return {
        opened: false,
        reason: "PACKAGE_NIGHTS_BELOW_MIN",
        programCode,
        nights: err.nights,
        minNights: err.minNights,
      };
    }
    if (isTemplateMissing(err, programCode)) {
      return { opened: false, reason: "TEMPLATE_NOT_FOUND", programCode };
    }
    console.error("[day1] tryOpenProgramAfterTherapistStage", episodeId, err);
    return { opened: false, reason: "INSTANTIATE_FAILED", programCode };
  }
}
