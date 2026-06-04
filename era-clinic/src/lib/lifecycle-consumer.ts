import type {
  SatelliteHotelGuestCheckedInEvent,
  SatelliteHotelGuestCheckedOutEvent,
  SatelliteHotelRoomChangedEvent,
  SatelliteHotelSanatoriumBookingCreatedEvent,
} from "@era/contracts";
import { openEpisodeFromStay } from "@/lib/services/sanatorium.service";
import { instantiateProgramFromTemplate } from "@/lib/sanatorium-scheduler.service";
import { prisma } from "@/lib/prisma";

async function ensureEpisodeAndProgram(
  event: {
    organizationId: string;
    globalPersonId?: string;
    payload: {
      reservationId: string;
      programCode?: string;
      guestName?: string;
      globalPersonId?: string;
      checkInDate?: string;
    };
  },
) {
  const p = event.payload;
  const episode = await openEpisodeFromStay({
    reservationId: p.reservationId,
    guestName: p.guestName ?? "Guest",
    passportNumber: p.reservationId,
    phone: undefined,
    organizationId: event.organizationId,
    globalPersonId: p.globalPersonId ?? event.globalPersonId,
    hotelStayId: p.reservationId,
  });
  const existingProgram = await prisma.programInstance.findUnique({
    where: { episodeId: episode.id },
  });
  if (p.programCode && !existingProgram) {
    await instantiateProgramFromTemplate({
      episodeId: episode.id,
      programCode: p.programCode,
      reservationId: p.reservationId,
      startsOn: p.checkInDate ? new Date(p.checkInDate) : new Date(),
    });
  }
  return episode;
}

export async function handleSanatoriumBookingCreated(
  event: SatelliteHotelSanatoriumBookingCreatedEvent,
) {
  return ensureEpisodeAndProgram(event);
}

export async function handleGuestCheckedIn(
  event: SatelliteHotelGuestCheckedInEvent,
) {
  return ensureEpisodeAndProgram(event);
}

export async function handleGuestCheckedOut(
  event: SatelliteHotelGuestCheckedOutEvent,
) {
  const p = event.payload;
  await prisma.clinicalEpisode.updateMany({
    where: { reservationId: p.reservationId, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await prisma.procedureOrder.updateMany({
    where: {
      reservationId: p.reservationId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
    data: { status: "CANCELLED" },
  });
}

export async function handleRoomChanged(event: SatelliteHotelRoomChangedEvent) {
  const p = event.payload;
  await prisma.visit.updateMany({
    where: { reservationId: p.reservationId, status: "IN_PROGRESS" },
    data: { roomNumber: p.newRoomNumber },
  });
  await prisma.clinicalEpisode.updateMany({
    where: { reservationId: p.reservationId },
    data: {},
  });
}
