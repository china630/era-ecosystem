import { prisma } from "@/lib/prisma";
import type { PrintPatientStrip } from "@/domain/print/print-types";
import { bakuDateKey } from "@/lib/baku-day";
import { nightsBetween } from "@/lib/program-quota";
import { listEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";

export type PrintStayFields = {
  roomNumber: string | null;
  doctorName: string | null;
  arrival: string | null;
  departure: string | null;
  stayDays: number | null;
};

export const EMPTY_PRINT_STAY: PrintStayFields = {
  roomNumber: null,
  doctorName: null,
  arrival: null,
  departure: null,
  stayDays: null,
};

/** Print Doctor = episode care team, never cabin/roster STAFF. */
export function episodeCareTeamPrintName(names: string[]): string {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "—";
}

export function composePrintPatientStrip(input: {
  fullName: string;
  sex: string | null | undefined;
  birthDate: Date | string | null | undefined;
  phone: string | null | undefined;
  nationality: string | null | undefined;
  date: string;
  stay?: PrintStayFields | null;
  doctorName?: string | null;
  roomNumber?: string | null;
}): PrintPatientStrip {
  const stay = input.stay ?? EMPTY_PRINT_STAY;
  let birthDate: string | null = null;
  if (input.birthDate instanceof Date) birthDate = bakuDateKey(input.birthDate);
  else if (typeof input.birthDate === "string" && input.birthDate.trim()) {
    birthDate = input.birthDate.slice(0, 10);
  }
  return {
    fullName: input.fullName,
    sex: input.sex ?? null,
    birthDate,
    phone: input.phone ?? null,
    nationality: input.nationality ?? null,
    roomNumber: input.roomNumber ?? stay.roomNumber,
    doctorName: input.doctorName ?? stay.doctorName,
    date: input.date,
    arrival: stay.arrival,
    departure: stay.departure,
    stayDays: stay.stayDays,
  };
}

export async function loadPrintEpisodeStay(opts: {
  episodeId?: string | null;
  patientRefId?: string | null;
}): Promise<PrintStayFields> {
  const episode = opts.episodeId
    ? await prisma.clinicalEpisode.findUnique({
        where: { id: opts.episodeId },
        include: { programInstance: { select: { startsOn: true, endsOn: true } } },
      })
    : opts.patientRefId
      ? await prisma.clinicalEpisode.findFirst({
          where: { patientRefId: opts.patientRefId },
          orderBy: { openedAt: "desc" },
          include: { programInstance: { select: { startsOn: true, endsOn: true } } },
        })
      : null;
  if (!episode) return { ...EMPTY_PRINT_STAY };

  const start = episode.programInstance?.startsOn ?? episode.openedAt;
  const end = episode.programInstance?.endsOn ?? episode.closedAt;
  const care = await listEpisodeCareDoctors(episode.id);
  const nights = start && end ? nightsBetween(start, end) : 0;

  return {
    roomNumber: episode.roomNumber ?? null,
    doctorName: episodeCareTeamPrintName(care.map((row) => row.practitioner.fullName)),
    arrival: start ? bakuDateKey(start) : null,
    departure: end ? bakuDateKey(end) : null,
    stayDays: nights > 0 ? nights : null,
  };
}
