import { prisma } from "@/lib/prisma";
import { acceptGuestPackageCode } from "@/lib/integration/clinic-program-codes";

export type ClinicSyncGuest = {
  reservationId: string;
  reservationStatus: "IN_HOUSE" | "CHECKED_OUT";
  paxKey: string;
  departed: boolean;
  globalPersonId?: string;
  programCode: string;
  roomNumber?: string;
  guestName: string;
  sex?: string;
  birthDate?: string;
  nationality?: string;
  phone?: string;
  checkInDate: string;
  checkOutDate: string;
};

function ymd(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function listClinicSyncSnapshot(input: {
  organizationId: string;
  openReservationIds: string[];
}): Promise<{ inHouse: ClinicSyncGuest[]; checkedOutIds: string[] }> {
  const openIds = [...new Set(input.openReservationIds.map((id) => id.trim()).filter(Boolean))].slice(0, 500);
  const checkedOut = openIds.length
    ? await prisma.reservation.findMany({
        where: { organizationId: input.organizationId, id: { in: openIds }, status: "CHECKED_OUT" },
        select: { id: true },
      })
    : [];

  const stays = await prisma.reservation.findMany({
    where: { organizationId: input.organizationId, status: "IN_HOUSE" },
    select: {
      id: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      medicalPackageCode: true,
      room: { select: { roomNumber: true } },
      guest: {
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          globalPersonId: true,
          sex: true,
          birthDate: true,
          nationality: true,
          phone: true,
        },
      },
      paxGuests: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          sex: true,
          birthDate: true,
          nationality: true,
          medicalPackageCode: true,
          departedAt: true,
          guest: {
            select: {
              fullName: true,
              globalPersonId: true,
              sex: true,
              birthDate: true,
              nationality: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  const inHouse: ClinicSyncGuest[] = [];
  for (const stay of stays) {
    for (const pax of stay.paxGuests) {
      const programCode = await acceptGuestPackageCode(pax.medicalPackageCode);
      if (!programCode) continue;
      const guestName =
        [pax.firstName, pax.lastName].filter(Boolean).join(" ").trim() ||
        pax.guest?.fullName?.trim() ||
        "Guest";
      const birth = pax.birthDate ?? pax.guest?.birthDate ?? null;
      inHouse.push({
        reservationId: stay.id,
        reservationStatus: "IN_HOUSE",
        paxKey: pax.id,
        departed: Boolean(pax.departedAt),
        ...(pax.guest?.globalPersonId ? { globalPersonId: pax.guest.globalPersonId } : {}),
        programCode,
        ...(stay.room?.roomNumber ? { roomNumber: stay.room.roomNumber } : {}),
        guestName,
        ...((pax.sex ?? pax.guest?.sex) ? { sex: (pax.sex ?? pax.guest?.sex) as string } : {}),
        ...(birth ? { birthDate: ymd(birth) } : {}),
        ...((pax.nationality ?? pax.guest?.nationality)
          ? { nationality: (pax.nationality ?? pax.guest?.nationality) as string }
          : {}),
        ...(pax.guest?.phone ? { phone: pax.guest.phone } : {}),
        checkInDate: stay.checkInDate.toISOString(),
        checkOutDate: stay.checkOutDate.toISOString(),
      });
    }
    if (stay.paxGuests.length > 0) continue;
    const programCode = await acceptGuestPackageCode(stay.medicalPackageCode);
    if (!programCode || !stay.guest) continue;
    const birth = stay.guest.birthDate;
    inHouse.push({
      reservationId: stay.id,
      reservationStatus: "IN_HOUSE",
      paxKey: stay.guest.id,
      departed: false,
      ...(stay.guest.globalPersonId ? { globalPersonId: stay.guest.globalPersonId } : {}),
      programCode,
      ...(stay.room?.roomNumber ? { roomNumber: stay.room.roomNumber } : {}),
      guestName:
        stay.guest.fullName?.trim() ||
        [stay.guest.firstName, stay.guest.lastName].filter(Boolean).join(" ").trim() ||
        "Guest",
      ...(stay.guest.sex ? { sex: stay.guest.sex } : {}),
      ...(birth ? { birthDate: ymd(birth) } : {}),
      ...(stay.guest.nationality ? { nationality: stay.guest.nationality } : {}),
      ...(stay.guest.phone ? { phone: stay.guest.phone } : {}),
      checkInDate: stay.checkInDate.toISOString(),
      checkOutDate: stay.checkOutDate.toISOString(),
    });
  }

  return { inHouse, checkedOutIds: checkedOut.map((row) => row.id) };
}
