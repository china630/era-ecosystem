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

export async function handleStayProductChanged(
  event: SatelliteHotelStayProductChangedEvent,
) {
  const p = event.payload;
  const effective = p.effectiveDate ? new Date(p.effectiveDate) : new Date();
  await prisma.clinicalEpisode.updateMany({
    where: { reservationId: p.reservationId, status: "OPEN" },
    data: { programCode: p.programCode ?? undefined },
  });
  await prisma.procedureOrder.updateMany({
    where: {
      reservationId: p.reservationId,
      status: { in: ["PROPOSED", "SCHEDULED"] },
      scheduledAt: { gte: effective },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "hotel_stay_product_changed",
    },
  });
  if (!p.programCode) return;
  const episode = await prisma.clinicalEpisode.findFirst({
    where: { reservationId: p.reservationId, status: "OPEN" },
  });
  if (!episode) return;
  const existing = await prisma.programInstance.findUnique({
    where: { episodeId: episode.id },
  });
  try {
    if (existing) {
      const template = await prisma.programTemplate.findFirst({
        where: { code: p.programCode },
      });
      await prisma.programInstance.update({
        where: { id: existing.id },
        data: {
          programCode: p.programCode,
          ...(template ? { templateId: template.id, startsOn: effective } : {}),
        },
      });
      await buildProposedPlan(existing.id);
      return;
    }
    await instantiateProgramFromTemplate({
      episodeId: episode.id,
      programCode: p.programCode,
      reservationId: p.reservationId,
      startsOn: effective,
    });
  } catch {
    /* no matching template */
  }
}
