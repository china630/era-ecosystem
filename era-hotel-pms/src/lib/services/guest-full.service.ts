import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';

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
  }>,
) {
  const { birthDate, ...rest } = input;
  await prisma.guest.update({
    where: { id },
    data: {
      ...rest,
      birthDate: birthDate === undefined ? undefined : birthDate ? new Date(birthDate) : null,
    },
  });
  return getGuestFull(id);
}
