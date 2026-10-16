import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';
import { decimalToNumber } from '@/lib/decimal';
import { parseRoomChargeNote, roomChargeNote } from '@/lib/folio-charge-note';
import { prisma } from '@/lib/prisma';
import {
  requireRevenueCodeByRole,
  revenueRoleIn,
  STAY_NIGHT_ROLES,
} from '@/lib/revenue-code-token';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { postCharge } from '@/lib/services/folio.service';
import { getNightlyRoomChargeForDate } from '@/lib/services/pricing-quote.service';

export type MissedNight = { date: string; amount: number };

export async function listMissedRoomNights(reservationId: string): Promise<{
  nights: MissedNight[];
  total: number;
}> {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      dailyRates: true,
      folios: { include: { charges: { include: { revenueCode: true } } } },
    },
  });
  if (!res) throw new Error('Reservation not found');

  const bizKey = hotelDateKey(await getCurrentBusinessDate());
  const posted = new Set<string>();
  for (const folio of res.folios) {
    for (const charge of folio.charges) {
      if (!revenueRoleIn(charge.revenueCode, STAY_NIGHT_ROLES)) continue;
      if (charge.qty < 0 || decimalToNumber(charge.amount) <= 0) continue;
      if ((charge.description ?? '').startsWith('Void ')) continue;
      const noted = parseRoomChargeNote(charge.description ?? '');
      posted.add(noted?.date ?? hotelDateKey(charge.businessDate));
    }
  }

  const nights: MissedNight[] = [];
  let cur = hotelDateKey(res.checkInDate);
  const end = hotelDateKey(res.checkOutDate);
  while (cur < end && cur < bizKey) {
    if (!posted.has(cur)) {
      const rate = res.dailyRates.find((row) => hotelDateKey(row.stayDate) === cur);
      let amount = rate ? decimalToNumber(rate.amount) : 0;
      if (!rate) {
        try {
          amount = await getNightlyRoomChargeForDate(res.id, bakuCivilUtcDate(cur));
        } catch {
          amount = 0;
        }
      }
      if (amount > 0.009) nights.push({ date: cur, amount: Math.round(amount * 100) / 100 });
    }
    cur = addHotelDays(cur, 1);
  }
  const total = Math.round(nights.reduce((sum, night) => sum + night.amount, 0) * 100) / 100;
  return { nights, total };
}

export async function postMissedRoomNights(reservationId: string, actorUserId?: string) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, status: true },
  });
  if (!res) throw new Error('Reservation not found');
  if (!['CONFIRMED', 'IN_HOUSE'].includes(res.status)) {
    throw new Error('Missed nights post only on an open stay');
  }
  const preview = await listMissedRoomNights(reservationId);
  if (preview.nights.length === 0) return preview;
  const revenueRoom = await requireRevenueCodeByRole('ROOM');
  const openDate = await getCurrentBusinessDate();
  for (const night of preview.nights) {
    await postCharge({
      reservationId,
      revenueCodeId: revenueRoom.id,
      amount: night.amount,
      qty: 1,
      description: roomChargeNote('manual-room', night.date),
      businessDate: openDate,
      audit: { userId: actorUserId, source: 'night_audit' },
    });
  }
  return preview;
}
