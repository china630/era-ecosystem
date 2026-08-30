import type {
  SatelliteHotelGuestCheckedInEvent,
  SatelliteHotelGuestCheckedOutEvent,
  SatelliteHotelRoomChangedEvent,
  SatelliteHotelSanatoriumBookingCreatedEvent,
  SatelliteHotelStayProductChangedEvent,
} from "@era/contracts";
import { shouldAutoInstantiateProgramOnCheckin } from "@/domain/settings/scheduling-settings";
import { openEpisodeFromStay } from "@/lib/services/sanatorium.service";
import { instantiateProgramFromTemplate } from "@/lib/sanatorium-scheduler.service";
import { buildProposedPlan } from "@/lib/treatment-planner.service";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant } from "@/lib/request-organization";

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
      paxKey?: string;
    };
  },
) {
  enterRequestTenant(event.organizationId);
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
    paxKey: p.paxKey,
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
  enterRequestTenant(event.organizationId);
  const p = event.payload;
  // Wave E: close ALL OPEN episodes for the reservation (both spouses)
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
  enterRequestTenant(event.organizationId);
  const p = event.payload;
  await prisma.visit.updateMany({
    where: { reservationId: p.reservationId, status: "IN_PROGRESS" },
    data: { roomNumber: p.newRoomNumber },
  });
  // Fan-out room to all OPEN episodes on this reservation
  await prisma.clinicalEpisode.updateMany({
    where: { reservationId: p.reservationId, status: "OPEN" },
    data: { roomNumber: p.newRoomNumber },
  });
}

export async function handleStayProductChanged(
  event: SatelliteHotelStayProductChangedEvent,
) {
  enterRequestTenant(event.organizationId);
  const p = event.payload;
  const effective = p.effectiveDate ? new Date(p.effectiveDate) : new Date();

  // Optional person-scoped amend; else all OPEN episodes on the reservation (Wave E)
  const episodeWhere = {
    reservationId: p.reservationId,
    status: "OPEN" as const,
    ...(p.globalPersonId
      ? {
          OR: [
            { globalPersonId: p.globalPersonId },
            { patientRef: { globalPersonId: p.globalPersonId } },
          ],
        }
      : {}),
  };

  if (p.programCode) {
    await prisma.clinicalEpisode.updateMany({
      where: episodeWhere,
      data: { programCode: p.programCode },
    });
  }

  // Wave B: do NOT cancel SCHEDULED / CHECKED_IN / COMPLETED on package or date change.

  if (!p.programCode && !p.checkInDate && !p.checkOutDate) return;

  const episodes = await prisma.clinicalEpisode.findMany({
    where: episodeWhere,
    include: { programInstance: true },
  });
  if (episodes.length === 0) return;

  const { nightsBetween } = await import("@/lib/program-quota");
  const { recalcProgramQuotas } = await import("@/lib/sanatorium-scheduler.service");

  for (const episode of episodes) {
    const existing = episode.programInstance;
    const programCode = p.programCode ?? episode.programCode;
    const checkIn = p.checkInDate
      ? new Date(p.checkInDate)
      : existing?.startsOn ?? effective;
    const checkOut = p.checkOutDate
      ? new Date(p.checkOutDate)
      : existing?.endsOn ?? effective;
    const nights = nightsBetween(checkIn, checkOut) || 1;

    try {
      if (existing) {
        await recalcProgramQuotas(existing.id, {
          nights,
          programCode: programCode ?? existing.programCode,
          endsOn: checkOut,
          reservationId: p.reservationId,
        });
        await buildProposedPlan(existing.id);
        continue;
      }
      if (!programCode) continue;
      await instantiateProgramFromTemplate({
        episodeId: episode.id,
        programCode,
        reservationId: p.reservationId,
        startsOn: checkIn,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
      });
    } catch (e) {
      console.error("stay-product recalc failed", episode.id, e);
    }
  }
}
