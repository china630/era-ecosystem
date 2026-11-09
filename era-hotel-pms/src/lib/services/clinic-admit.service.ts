import { prisma } from '@/lib/prisma';
import { openFoliosForReservation } from '@/lib/services/folio.service';
import { normalizeMedicalPackageCode } from '@/lib/services/medical-package-resolve.service';
import {
  dispatchGuestCheckedIn,
  dispatchGuestDeparted,
  lifecycleDemographicsFromPax,
} from '@/lib/integration/guest-lifecycle-events';
import { paxLifecycleGlobalPersonId } from '@/lib/integration/pax-lifecycle-person';

const ADMIT_STATUSES = ['OPTION', 'CONFIRMED'] as const;

async function loadPax(reservationId: string, paxId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      room: true,
      paxGuests: { where: { id: paxId }, include: { guest: true } },
    },
  });
  const pax = reservation?.paxGuests[0] ?? null;
  return { reservation, pax };
}

/** Open this guest's clinic episode before the room is received. Stay status stays put. */
export async function admitGuestToClinic(reservationId: string, paxId: string) {
  const { reservation, pax } = await loadPax(reservationId, paxId);
  if (!reservation || !pax) {
    throw Object.assign(new Error('Guest is not on this stay'), { status: 404 });
  }
  if (!ADMIT_STATUSES.includes(reservation.status as (typeof ADMIT_STATUSES)[number])) {
    throw Object.assign(new Error('Clinic admit is only before hotel check-in'), {
      status: 409,
      code: 'CLINIC_ADMIT_STAY',
    });
  }
  if (pax.departedAt) {
    throw Object.assign(new Error('Departed guest cannot enter the sanatorium'), {
      status: 409,
      code: 'CLINIC_ADMIT_DEPARTED',
    });
  }
  const programCode = normalizeMedicalPackageCode(pax.medicalPackageCode);
  if (!programCode) {
    throw Object.assign(new Error('Guest has no medical package'), {
      status: 409,
      code: 'CLINIC_ADMIT_NO_PACKAGE',
    });
  }
  if (!pax.clinicAdmittedAt) {
    await prisma.reservationGuest.update({
      where: { id: pax.id },
      data: { clinicAdmittedAt: new Date() },
    });
  }
  await openFoliosForReservation(reservationId);
  const name =
    [pax.firstName, pax.lastName].filter(Boolean).join(' ') ||
    pax.guest?.fullName ||
    'Guest';
  await dispatchGuestCheckedIn({
    reservationId,
    roomNumber: reservation.room?.roomNumber ?? undefined,
    programCode,
    globalPersonId: paxLifecycleGlobalPersonId({
      isPrimary: pax.isPrimary,
      guestId: pax.guestId,
      guest: pax.guest,
      primaryGuest: reservation.guest,
    }),
    guestName: name,
    checkInDate: reservation.checkInDate.toISOString(),
    checkOutDate: reservation.checkOutDate.toISOString(),
    paxKey: pax.id,
    ...lifecycleDemographicsFromPax(pax),
  });
  return { reservationId, paxId: pax.id, admitted: true };
}

/** Close the clinic episode opened early. Does not mark the guest departed from the hotel. */
export async function revokeGuestClinicAdmit(reservationId: string, paxId: string) {
  const { reservation, pax } = await loadPax(reservationId, paxId);
  if (!reservation || !pax) {
    throw Object.assign(new Error('Guest is not on this stay'), { status: 404 });
  }
  if (!pax.clinicAdmittedAt) return { reservationId, paxId, admitted: false };
  await prisma.reservationGuest.update({
    where: { id: pax.id },
    data: { clinicAdmittedAt: null },
  });
  const name =
    [pax.firstName, pax.lastName].filter(Boolean).join(' ') ||
    pax.guest?.fullName ||
    'Guest';
  await dispatchGuestDeparted({
    reservationId,
    paxKey: pax.id,
    roomNumber: reservation.room?.roomNumber ?? undefined,
    programCode: normalizeMedicalPackageCode(pax.medicalPackageCode) ?? undefined,
    globalPersonId: paxLifecycleGlobalPersonId({
      isPrimary: pax.isPrimary,
      guestId: pax.guestId,
      guest: pax.guest,
      primaryGuest: reservation.guest,
    }),
    guestName: name,
  });
  return { reservationId, paxId, admitted: false };
}
