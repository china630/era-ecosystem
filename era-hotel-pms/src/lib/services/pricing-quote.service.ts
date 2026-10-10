import { decimalToNumber } from '@/lib/decimal';
import { NightlyPriceMissingError, usesBarCalendar } from '@/lib/pricing/own-nightly-price';
import { quoteStay, PricingEngineError } from '@/lib/services/pricing-engine.service';
import { quoteBookingRate } from '@/lib/services/contract-pricing.service';
import { prisma } from '@/lib/prisma';

export { NightlyPriceMissingError } from '@/lib/pricing/own-nightly-price';

const LEGACY_FALLBACK =
  process.env.ERA_PRICING_LEGACY_FALLBACK === 'true' ||
  process.env.ERA_PRICING_LEGACY_FALLBACK === '1';

export type QuoteReservationStayInput = {
  ratePlanId: string;
  roomTypeId: string;
  checkInDate: Date;
  checkOutDate: Date;
  agencyId?: string;
  guests?: number;
  optionalAddOnIds?: string[];
};

export type ReservationStayQuote = {
  source: 'BAR' | 'LEGACY';
  currency: string;
  nights: number;
  nightlyRates: Array<{ date: string; amount: number }>;
  adultNightly: number;
  roomTotal: number;
  addOnTotal: number;
  totalAmount: number;
  ratePlanCode?: string;
  contractRuleId?: string | null;
  contractRuleName?: string | null;
  warning?: string;
};

function averageNightly(nightlyRates: Array<{ amount: number }>): number {
  if (nightlyRates.length === 0) return 0;
  const sum = nightlyRates.reduce((s, r) => s + r.amount, 0);
  return Math.round((sum / nightlyRates.length) * 100) / 100;
}

async function resolveRoomTypeId(
  ratePlanId: string,
  roomTypeId?: string,
): Promise<string> {
  if (roomTypeId) return roomTypeId;
  const plan = await prisma.ratePlan.findUnique({
    where: { id: ratePlanId },
    select: { roomTypeId: true },
  });
  if (plan?.roomTypeId) return plan.roomTypeId;
  const fallback = await prisma.roomType.findFirst({
    where: { active: true },
    orderBy: { code: 'asc' },
    select: { id: true },
  });
  if (!fallback) throw new Error('No active room type configured');
  return fallback.id;
}

/**
 * Facade: quoteStay (BAR calendar) with optional legacy fallback for Nafta cutover.
 */
export async function quoteReservationStay(
  input: QuoteReservationStayInput,
): Promise<ReservationStayQuote> {
  const roomTypeId = await resolveRoomTypeId(input.ratePlanId, input.roomTypeId);

  try {
    const quote = await quoteStay({
      ratePlanId: input.ratePlanId,
      roomTypeId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      guests: input.guests,
      optionalAddOnIds: input.optionalAddOnIds,
    });

    const nightlyRates = quote.room.perNight.map((r) => ({
      date: r.date,
      amount: r.amount,
    }));
    const adultNightly = averageNightly(nightlyRates);
    const roomTotal = quote.room.total;
    const addOnTotal = quote.addOnTotal;

    return {
      source: 'BAR',
      currency: quote.currency,
      nights: quote.nights,
      nightlyRates,
      adultNightly,
      roomTotal,
      addOnTotal,
      totalAmount: quote.grandTotal,
    };
  } catch (err) {
    if (!(err instanceof PricingEngineError) || err.code !== 'RATE_NOT_LOADED') {
      throw err;
    }
    if (!LEGACY_FALLBACK) {
      throw err;
    }

    const legacy = await quoteBookingRate({
      ratePlanId: input.ratePlanId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      agencyId: input.agencyId,
    });

    const nightlyRates = Array.from({ length: legacy.nights }, (_, i) => {
      const d = new Date(input.checkInDate);
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d.toISOString().slice(0, 10), amount: legacy.adjustedNightly };
    });

    return {
      source: 'LEGACY',
      currency: 'AZN',
      nights: legacy.nights,
      nightlyRates,
      adultNightly: legacy.adjustedNightly,
      roomTotal: legacy.totalAmount,
      addOnTotal: 0,
      totalAmount: legacy.totalAmount,
      ratePlanCode: legacy.ratePlanCode,
      contractRuleId: legacy.contractRuleId,
      contractRuleName: legacy.contractRuleName,
      warning: `BAR rates missing; used legacy pricePerNight (${err.message})`,
    };
  }
}

export async function getNightlyRoomChargeForDate(
  reservationId: string,
  businessDate: Date,
): Promise<number> {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      dailyRates: true,
      ratePlan: true,
      room: true,
      roomType: { select: { code: true } },
      mealPlan: { select: { code: true } },
      paxGuests: {
        select: { medicalPackageCode: true, firstName: true, lastName: true, guestId: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  if (!res) throw new Error('Reservation not found');

  const daily = res.dailyRates.find(
    (d) => d.stayDate.toISOString().slice(0, 10) === businessDate.toISOString().slice(0, 10),
  );
  if (daily) return decimalToNumber(daily.amount);

  const { resolveStaySliceForDate } = await import('@/lib/services/stay-slice.service');
  const slice = await resolveStaySliceForDate(reservationId, businessDate);

  const { ownerPackageNightlySell } = await import(
    '@/lib/services/nafta-package-compose-apply.service'
  );
  const { paxCodesForCompose } = await import('@/lib/services/nafta-package-compose.service');
  const { MEDICAL_PACKAGE_CODES } = await import('@/lib/services/medical-package-resolve.service');
  const packageCodes = (
    res.paxGuests.length > 0
      ? paxCodesForCompose(res.paxGuests, res.ratePlan.code ?? res.medicalPackageCode)
      : [res.medicalPackageCode]
  )
    .map((c) => (c ?? '').trim().toUpperCase())
    .filter((c) => (MEDICAL_PACKAGE_CODES as readonly string[]).includes(c));
  if (packageCodes.length > 0 || res.ratePlan.medicalFlag) {
    const roomTypeId = slice?.roomTypeId ?? res.roomTypeId;
    const nightly = roomTypeId
      ? await ownerPackageNightlySell(businessDate, packageCodes, {
          roomTypeId,
          mealPlanId: res.mealPlanId,
        })
      : null;
    if (nightly == null) {
      throw new NightlyPriceMissingError(res.id, res.ratePlan.code, {
        packageCode: packageCodes.join("+"),
        roomTypeCode: res.roomType?.code ?? null,
        mealCode: res.mealPlan?.code ?? null,
      });
    }
    return nightly;
  }

  const gridRoomTypeId = slice?.roomTypeId ?? res.roomTypeId;
  if (!res.ratePlan.medicalFlag && gridRoomTypeId && res.mealPlanId) {
    const { ratePlanGridNightlySell } = await import(
      "@/lib/services/nafta-package-compose-apply.service"
    );
    const grid = await ratePlanGridNightlySell(businessDate, {
      ratePlanId: res.ratePlanId,
      roomTypeId: gridRoomTypeId,
      mealPlanId: res.mealPlanId,
      occupancy: Math.max(1, res.adults),
    });
    if (grid != null) return grid;
  }

  const planId = slice?.ratePlanId ?? res.ratePlanId;
  const plan =
    planId === res.ratePlan.id
      ? res.ratePlan
      : await prisma.ratePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('Rate plan not found');

  const ownPrice = () => {
    const amount = decimalToNumber(plan.pricePerNight);
    if (amount > 0) return amount;
    throw new NightlyPriceMissingError(res.id, plan.code);
  };

  const roomTypeId = slice?.roomTypeId ?? res.roomTypeId ?? plan.roomTypeId;
  if (!roomTypeId || !usesBarCalendar(plan)) {
    return ownPrice();
  }

  try {
    const quote = await quoteReservationStay({
      ratePlanId: plan.id,
      roomTypeId,
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
      agencyId: res.agencyId ?? undefined,
      guests: res.adults + res.children1_0 + res.children5_2 + res.children11_6,
    });

    const key = businessDate.toISOString().slice(0, 10);
    const night = quote.nightlyRates.find((n) => n.date === key);
    return night?.amount ?? quote.adultNightly;
  } catch (err) {
    if (err instanceof PricingEngineError && err.code === 'RATE_NOT_LOADED') {
      throw new NightlyPriceMissingError(res.id, plan.code);
    }
    if (
      err instanceof PricingEngineError &&
      (err.code === 'BASE_PLAN_NOT_FOUND' || err.code === 'INVALID_DERIVATION')
    ) {
      return ownPrice();
    }
    throw err;
  }
}
