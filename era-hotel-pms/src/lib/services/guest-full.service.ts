import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { relinkGuestGlobalPerson } from '@/lib/services/guest.service';

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
  return { guest, stats };
}

export async function patchGuestFull(
  id: string,
  input: Partial<{
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    title: string | null;
    gender: string | null;
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
    fatherName: string | null;
    motherName: string | null;
    verificationStatus: string | null;
    marriageDate: string | null;
    bonusPercent: number | null;
    phoneVerified: boolean;
    emailVerified: boolean;
    isLocked: boolean;
  }>,
) {
  const { birthDate, visaExpiry, marriageDate, bonusPercent, nationalIdFin, passportNumber, fullName, nationality, phone, ...rest } = input;
  if (
    nationalIdFin !== undefined ||
    passportNumber !== undefined ||
    fullName !== undefined
  ) {
    const existing = await prisma.guest.findUnique({ where: { id } });
    if (existing) {
      await relinkGuestGlobalPerson(id, {
        fullName: fullName ?? existing.fullName,
        nationalIdFin: nationalIdFin ?? existing.nationalIdFin,
        passportNumber: passportNumber ?? existing.passportNumber,
        nationality: nationality ?? existing.nationality,
        phone: phone ?? existing.phone,
      });
    }
  }
  await prisma.guest.update({
    where: { id },
    data: {
      ...rest,
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
