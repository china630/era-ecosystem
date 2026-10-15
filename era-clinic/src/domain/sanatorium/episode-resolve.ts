import { lookupHotelStayWindow } from "@/lib/hotel-stay-person";
import { prisma } from "@/lib/prisma";
import { nightsBetween } from "@/lib/program-quota";

export type EpisodeListItem = {
  id: string;
  status: string;
  patientOrigin: string;
  programCode: string | null;
  roomNumber: string | null;
  reservationId: string | null;
  openedAt: string;
  closedAt: string | null;
  stayStartsOn: string | null;
  stayEndsOn: string | null;
  stayNights: number | null;
  anamnesisText: string | null;
  anamnesisUpdatedAt: string | null;
  anamnesisByPractitioner: { fullName: string; specialty: string | null } | null;
  label: string;
};

function bakuDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Baku" });
}

export function formatEpisodeLabel(row: {
  openedAt: Date;
  closedAt: Date | null;
  programCode: string | null;
  status: string;
  patientOrigin: string;
  roomNumber: string | null;
}): string {
  const start = bakuDate(row.openedAt);
  const end = row.closedAt ? bakuDate(row.closedAt) : "…";
  const program = row.programCode ?? "—";
  const room = row.roomNumber ? ` · ${row.roomNumber}` : "";
  return `${start}–${end} · ${program} · ${row.status}${room}`;
}

/** All courses for a patient, latest first. */
export async function listPatientEpisodes(
  patientRefId: string,
): Promise<EpisodeListItem[]> {
  const rows = await prisma.clinicalEpisode.findMany({
    where: { patientRefId },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      status: true,
      patientOrigin: true,
      programCode: true,
      roomNumber: true,
      reservationId: true,
      openedAt: true,
      closedAt: true,
      anamnesisText: true,
      anamnesisUpdatedAt: true,
      anamnesisByPractitioner: { select: { fullName: true, specialty: true } },
      programInstance: { select: { startsOn: true, endsOn: true } },
    },
  });
  const hotelWindows = new Map<string, { checkInDate: string; checkOutDate: string }>();
  await Promise.all(
    rows
      .filter((r) => !r.programInstance && r.reservationId)
      .map(async (r) => {
        const window = await lookupHotelStayWindow(r.reservationId!);
        if (window) hotelWindows.set(r.id, window);
      }),
  );
  return rows.map((r) => {
    const hotel = hotelWindows.get(r.id);
    const startsOn = r.programInstance?.startsOn ?? (hotel ? new Date(hotel.checkInDate) : null);
    const endsOn = r.programInstance?.endsOn ?? (hotel ? new Date(hotel.checkOutDate) : null);
    const datesOk =
      startsOn != null && endsOn != null && !Number.isNaN(startsOn.getTime()) && !Number.isNaN(endsOn.getTime());
    return {
      id: r.id,
      status: r.status,
      patientOrigin: r.patientOrigin,
      programCode: r.programCode,
      roomNumber: r.roomNumber,
      reservationId: r.reservationId,
      openedAt: r.openedAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      stayStartsOn: datesOk ? startsOn.toISOString() : null,
      stayEndsOn: datesOk ? endsOn.toISOString() : null,
      stayNights: datesOk ? nightsBetween(startsOn, endsOn) : null,
      anamnesisText: r.anamnesisText,
      anamnesisUpdatedAt: r.anamnesisUpdatedAt?.toISOString() ?? null,
      anamnesisByPractitioner: r.anamnesisByPractitioner,
      label: formatEpisodeLabel(r),
    };
  });
}

/**
 * Resolve course for card/print: explicit id (must belong to patient),
 * else latest by openedAt (OPEN or CLOSED).
 */
export async function resolveEpisodeForPatient(
  patientRefId: string,
  episodeId?: string | null,
): Promise<{
  id: string;
  status: string;
  anamnesisText: string | null;
  patientOrigin: string;
  programCode: string | null;
  reservationId: string | null;
  openedAt: Date;
  closedAt: Date | null;
} | null> {
  if (episodeId) {
    const row = await prisma.clinicalEpisode.findFirst({
      where: { id: episodeId, patientRefId },
      select: {
        id: true,
        status: true,
        anamnesisText: true,
        patientOrigin: true,
        programCode: true,
        reservationId: true,
        openedAt: true,
        closedAt: true,
      },
    });
    return row;
  }
  return prisma.clinicalEpisode.findFirst({
    where: { patientRefId },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      status: true,
      anamnesisText: true,
      patientOrigin: true,
      programCode: true,
      reservationId: true,
      openedAt: true,
      closedAt: true,
    },
  });
}
