import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import {
  enrichGuestWithMdmProfile,
  guestComposedFullName,
  updateGuestIdentity,
} from '@/lib/guest-identity';

export async function getGuestStats(id: string) {
  const guest = await prisma.guest.findUnique({ where: { id } });
  if (!guest) throw new Error('Guest not found');

  const reservations = await prisma.reservation.findMany({
    where: { guestId: id, status: { in: ['IN_HOUSE', 'CHECKED_OUT'] } },
    select: {
      checkInDate: true,
      checkOutDate: true,
      totalAmount: true,
    },
  });

  let totalNights = 0;
  let totalRevenue = 0;
  for (const r of reservations) {
    const nights = Math.max(
      1,
      Math.round(
        (r.checkOutDate.getTime() - r.checkInDate.getTime()) / 86400000,
      ),
    );
    totalNights += nights;
    totalRevenue += decimalToNumber(r.totalAmount);
  }

  const totalVisit = reservations.length;
  const avgRate = totalNights > 0 ? totalRevenue / totalNights : 0;

  return {
    totalVisit,
    totalNights,
    totalRevenue,
    avgRate,
    bonus: 0,
    surveysAverage: 0,
    comments: 0,
    preferences: 0,
  };
}

export async function getGuestFull(id: string) {
  const guest = await prisma.guest.findUnique({ where: { id } });
  if (!guest) throw new Error('Guest not found');
  const stats = await getGuestStats(id);
  const enriched = await enrichGuestWithMdmProfile(guest);
  return { guest: enriched, stats, mdmProfile: enriched.mdmProfile };
}

export async function patchGuestFull(
  id: string,
  input: Partial<{
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    title: string | null;
    sex: string | null;
    nationality: string;
    phone: string | null;
    email: string | null;
    vipType: string | null;
    birthDate: string | null;
    birthPlace: string | null;
    greyList: boolean;
    problematic: boolean;
    gdprConfirmed: boolean;
    smsConsent: boolean;
    whatsappConsent: boolean;
    phoneConsent: boolean;
    emailConsent: boolean;
    callBack: boolean;
    nationalIdFin: string | null;
    voen: string | null;
    passportNumber: string | null;
    occupation: string | null;
    registrationNumber: string | null;
    vehiclePlate: string | null;
    hotelName: string | null;
    visaType: string | null;
    visaNumber: string | null;
    visaExpiry: string | null;
    maritalStatus: string | null;
    parentFatherName: string | null;
    parentMotherName: string | null;
    verificationStatus: string | null;
    marriageDate: string | null;
    bonusPercent: number | null;
    phoneVerified: boolean;
    emailVerified: boolean;
    isLocked: boolean;
  }>,
) {
  const {
    birthDate,
    visaExpiry,
    marriageDate,
    bonusPercent,
    nationalIdFin,
    passportNumber,
    fullName,
    nationality,
    phone,
    firstName,
    middleName,
    lastName,
    sex,
    ...rest
  } = input;

  const existing = await prisma.guest.findUnique({ where: { id } });

  const composedFullName =
    firstName !== undefined || middleName !== undefined || lastName !== undefined
      ? guestComposedFullName({
          firstName: firstName ?? existing?.firstName,
          middleName: middleName ?? existing?.middleName,
          lastName: lastName ?? existing?.lastName,
          fullName: fullName ?? existing?.fullName,
        })
      : fullName;

  if (
    nationalIdFin !== undefined ||
    passportNumber !== undefined ||
    sex !== undefined ||
    birthDate !== undefined ||
    firstName !== undefined ||
    middleName !== undefined ||
    lastName !== undefined ||
    (composedFullName !== undefined && (nationalIdFin || passportNumber))
  ) {
    if (existing) {
      const shouldLink = Boolean(
        existing.globalPersonId ||
          nationalIdFin?.trim() ||
          passportNumber?.trim(),
      );
      if (shouldLink) {
        await updateGuestIdentity(id, {
          firstName: firstName !== undefined ? firstName : existing.firstName,
          middleName: middleName !== undefined ? middleName : existing.middleName,
          lastName: lastName !== undefined ? lastName : existing.lastName,
          fullName: composedFullName ?? existing.fullName,
          nationalIdFin: nationalIdFin ?? undefined,
          passportNumber: passportNumber ?? undefined,
          nationality: nationality ?? existing.nationality,
          phone: phone ?? existing.phone,
          globalPersonId: existing.globalPersonId,
          sex: sex !== undefined ? sex : existing.sex,
          birthDate: birthDate !== undefined ? birthDate : existing.birthDate,
        });
      }
    }
  }

  if (sex !== undefined) {
    const { assertGuestGenderChangeAllowed } = await import(
      '@/lib/services/share-assignment.service'
    );
    await assertGuestGenderChangeAllowed(id, sex);
  }

  await prisma.guest.update({
    where: { id },
    data: {
      ...rest,
      ...(sex !== undefined ? { sex } : {}),
      ...(firstName !== undefined ? { firstName } : {}),
      ...(middleName !== undefined ? { middleName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(composedFullName !== undefined ? { fullName: composedFullName } : {}),
      ...(nationality !== undefined ? { nationality } : {}),
      ...(phone !== undefined ? { phone } : {}),
      birthDate: birthDate === undefined ? undefined : birthDate ? new Date(birthDate) : null,
      visaExpiry:
        visaExpiry === undefined ? undefined : visaExpiry ? new Date(visaExpiry) : null,
      marriageDate:
        marriageDate === undefined
          ? undefined
          : marriageDate
            ? new Date(marriageDate)
            : null,
      bonusPercent:
        bonusPercent === undefined
          ? undefined
          : bonusPercent === null
            ? null
            : toDecimal(bonusPercent),
    },
  });
  return getGuestFull(id);
}
