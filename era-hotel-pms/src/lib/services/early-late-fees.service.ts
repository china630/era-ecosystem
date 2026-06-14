import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';

export type EarlyLatePolicy = {
  standardCheckInTime: string;
  standardCheckOutTime: string;
  earlyCheckInFeeMode: 'FIXED' | 'PERCENT_OF_NIGHT' | 'HOURLY';
  earlyCheckInFeeAmount: number;
  lateCheckOutFeeMode: 'FIXED' | 'PERCENT_OF_NIGHT' | 'HOURLY';
  lateCheckOutFeeAmount: number;
};

const DEFAULT_POLICY: EarlyLatePolicy = {
  standardCheckInTime: '14:00',
  standardCheckOutTime: '12:00',
  earlyCheckInFeeMode: 'PERCENT_OF_NIGHT',
  earlyCheckInFeeAmount: 50,
  lateCheckOutFeeMode: 'PERCENT_OF_NIGHT',
  lateCheckOutFeeAmount: 50,
};

export async function getHotelPolicy(): Promise<EarlyLatePolicy> {
  const profile = await prisma.hotelProfile.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!profile?.policyJson) return DEFAULT_POLICY;
  try {
    return { ...DEFAULT_POLICY, ...JSON.parse(profile.policyJson) };
  } catch {
    return DEFAULT_POLICY;
  }
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function computeFee(
  mode: EarlyLatePolicy['earlyCheckInFeeMode'],
  amount: number,
  nightlyRate: number,
  hourDelta: number,
): number {
  switch (mode) {
    case 'FIXED':
      return amount;
    case 'PERCENT_OF_NIGHT':
      return Math.round(nightlyRate * (amount / 100) * 100) / 100;
    case 'HOURLY':
      return Math.round(amount * Math.max(1, hourDelta) * 100) / 100;
    default:
      return 0;
  }
}

export async function previewEarlyLateFees(reservationId: string, input?: {
  checkInTime?: string;
  checkOutTime?: string;
}) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { ratePlan: true, room: true },
  });
  if (!res) throw new Error('Reservation not found');

  const policy = await getHotelPolicy();
  const roomTypeId = res.room?.roomTypeId ?? res.roomTypeId ?? res.ratePlan.roomTypeId;
  let nightlyRate = decimalToNumber(res.ratePlan.pricePerNight);
  if (roomTypeId) {
    const quote = await quoteReservationStay({
      ratePlanId: res.ratePlanId,
      roomTypeId,
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
      agencyId: res.agencyId ?? undefined,
    });
    nightlyRate = quote.adultNightly;
  }

  const checkInTime = input?.checkInTime ?? policy.standardCheckInTime;
  const checkOutTime = input?.checkOutTime ?? policy.standardCheckOutTime;

  const earlyMinutes = parseTimeToMinutes(policy.standardCheckInTime) - parseTimeToMinutes(checkInTime);
  const lateMinutes = parseTimeToMinutes(checkOutTime) - parseTimeToMinutes(policy.standardCheckOutTime);

  const earlyFee =
    earlyMinutes > 0
      ? computeFee(
          policy.earlyCheckInFeeMode,
          policy.earlyCheckInFeeAmount,
          nightlyRate,
          Math.ceil(earlyMinutes / 60),
        )
      : 0;

  const lateFee =
    lateMinutes > 0
      ? computeFee(
          policy.lateCheckOutFeeMode,
          policy.lateCheckOutFeeAmount,
          nightlyRate,
          Math.ceil(lateMinutes / 60),
        )
      : 0;

  return { earlyFee, lateFee, nightlyRate, policy };
}

export async function postEarlyCheckInFee(reservationId: string, checkInTime?: string) {
  const preview = await previewEarlyLateFees(reservationId, { checkInTime });
  if (preview.earlyFee <= 0) return { posted: false, amount: 0 };

  const code =
    (await prisma.revenueCode.findUnique({ where: { code: 'EARLY_CI' } })) ??
    (await prisma.revenueCode.findUnique({ where: { code: 'ROOM' } }));
  if (!code) throw new Error('Revenue code not configured');

  const bizDate = await getCurrentBusinessDate();
  await postCharge({
    reservationId,
    revenueCodeId: code.id,
    amount: preview.earlyFee,
    description: `Early check-in fee (${checkInTime ?? preview.policy.standardCheckInTime})`,
    businessDate: bizDate,
  });
  return { posted: true, amount: preview.earlyFee };
}

export async function postLateCheckOutFee(reservationId: string, checkOutTime?: string) {
  const preview = await previewEarlyLateFees(reservationId, { checkOutTime });
  if (preview.lateFee <= 0) return { posted: false, amount: 0 };

  const code =
    (await prisma.revenueCode.findUnique({ where: { code: 'LATE_CO' } })) ??
    (await prisma.revenueCode.findUnique({ where: { code: 'ROOM' } }));
  if (!code) throw new Error('Revenue code not configured');

  const bizDate = await getCurrentBusinessDate();
  await postCharge({
    reservationId,
    revenueCodeId: code.id,
    amount: preview.lateFee,
    description: `Late check-out fee (${checkOutTime ?? preview.policy.standardCheckOutTime})`,
    businessDate: bizDate,
  });
  return { posted: true, amount: preview.lateFee };
}
