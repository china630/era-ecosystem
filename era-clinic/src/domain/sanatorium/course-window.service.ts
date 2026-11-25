import { prisma } from "@/lib/prisma";
import { bakuDateKey, parseBakuDateTime } from "@/lib/baku-day";
import { nightsBetween } from "@/lib/program-quota";
import { recalcProgramQuotas } from "@/lib/sanatorium-scheduler.service";

export class CourseWindowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "CourseWindowError";
  }
}

export function parseCourseWindowEndsOnYmd(raw: string): string {
  const ymd = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new CourseWindowError("endsOn must be YYYY-MM-DD", "INVALID_ENDS_ON", 400);
  }
  return ymd;
}

export function assertCourseWindowNotHotelOwned(
  reservationId: string | null | undefined,
): void {
  if (reservationId) {
    throw new CourseWindowError(
      "Course dates are owned by the hotel stay",
      "HOTEL_OWNED_WINDOW",
      409,
    );
  }
}

/**
 * Extend / shorten a no-room course window.
 * Hotel episodes (reservationId set) are refused — hotel owns nights.
 */
export async function patchCourseWindow(input: {
  episodeId: string;
  endsOnYmd: string;
}) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: input.episodeId },
    include: { programInstance: true },
  });
  if (!episode) {
    throw new CourseWindowError("Episode not found", "NOT_FOUND", 404);
  }
  if (episode.status !== "OPEN") {
    throw new CourseWindowError("Episode is closed", "EPISODE_CLOSED", 409);
  }
  assertCourseWindowNotHotelOwned(episode.reservationId);
  const ymd = parseCourseWindowEndsOnYmd(input.endsOnYmd);
  const endsOn = parseBakuDateTime(ymd, "09:00");

  if (episode.programInstance) {
    const startsOn = episode.programInstance.startsOn;
    if (bakuDateKey(endsOn) <= bakuDateKey(startsOn)) {
      throw new CourseWindowError(
        "endsOn must be after startsOn",
        "INVALID_ENDS_ON",
        400,
      );
    }
    await prisma.programInstance.update({
      where: { id: episode.programInstance.id },
      data: { endsOn },
    });
    await prisma.clinicalEpisode.update({
      where: { id: episode.id },
      data: { plannedEndsOn: endsOn },
    });
    const nights = Math.max(1, nightsBetween(startsOn, endsOn) || 1);
    await recalcProgramQuotas(episode.programInstance.id, {
      endsOn,
      nights,
    });
    return {
      episodeId: episode.id,
      endsOnYmd: ymd,
      via: "program_instance" as const,
    };
  }

  await prisma.clinicalEpisode.update({
    where: { id: episode.id },
    data: { plannedEndsOn: endsOn },
  });
  return {
    episodeId: episode.id,
    endsOnYmd: ymd,
    via: "planned_ends_on" as const,
  };
}
