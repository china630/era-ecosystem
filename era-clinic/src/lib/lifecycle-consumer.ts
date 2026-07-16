import type {
  SatelliteHotelGuestCheckedInEvent,
  SatelliteHotelGuestCheckedOutEvent,
  SatelliteHotelRoomChangedEvent,
  SatelliteHotelSanatoriumBookingCreatedEvent,
} from "@era/contracts";
import { shouldAutoInstantiateProgramOnCheckin } from "@/domain/settings/scheduling-settings";
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
      roomNumber?: string;
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
    programCode: p.programCode,
    roomNumber: p.roomNumber,
  });
  const existingProgram = await prisma.programInstance.findUnique({
    where: { episodeId: episode.id },
  });
  const autoInstantiate = await shouldAutoInstantiateProgramOnCheckin();
  if (p.programCode && !existingProgram && autoInstantiate) {
    await instantiateProgramFromTemplate({
      episodeId: episode.id,
      programCode: p.programCode,
      reservationId: p.reservationId,
      startsOn: p.checkInDate ? new Date(p.checkInDate) : new Date(),
    });
    await prisma.clinicalEpisode.update({
      where: { id: episode.id },
      data: { checkupCompletedAt: new Date() },
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
      status: { in: ["SCHEDULED", "CHECKED_IN"] },
    },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "hotel_checkout" },
  });
}

export async function handleRoomChanged(event: SatelliteHotelRoomChangedEvent) {
  const p = event.payload;
  await prisma.visit.updateMany({
    where: { reservationId: p.reservationId, status: "IN_PROGRESS" },
    data: { roomNumber: p.newRoomNumber },
  });
  await prisma.clinicalEpisode.updateMany({
    where: { reservationId: p.reservationId, status: "OPEN" },
    data: { roomNumber: p.newRoomNumber },
  });
}
