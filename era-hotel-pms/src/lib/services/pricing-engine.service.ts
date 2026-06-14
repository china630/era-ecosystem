import type { RatePlan } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { countNights } from '@/lib/decimal';
import {
  assembleQuote,
  buildNightlyRoomRates,
  type RateQuote,
} from '@/lib/services/pricing-engine-core';

export class PricingEngineError extends Error {
  constructor(
    message: string,
    readonly code: 'RATE_PLAN_NOT_FOUND' | 'BASE_PLAN_NOT_FOUND' | 'RATE_NOT_LOADED' | 'INVALID_DERIVATION',
  ) {
    super(message);
    this.name = 'PricingEngineError';
  }
}

export type QuoteStayInput = {
  ratePlanId: string;
  roomTypeId: string;
  checkInDate: Date;
  checkOutDate: Date;
  guests?: number;
  /** Optional add-on IDs to include (must be linked as OPTIONAL on the rate plan). */
  optionalAddOnIds?: string[];
};

type ResolvedRatePlan = RatePlan & {
  derivedFrom: (RatePlan & { roomRevenueCode: { code: string } | null; roomTypeRates?: never } | null) | null;
  roomRevenueCode: { code: string } | null;
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  const cursor = new Date(checkIn.toISOString().slice(0, 10));
  const end = new Date(checkOut.toISOString().slice(0, 10));
  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

function resolveBasePlan(ratePlan: ResolvedRatePlan): {
  basePlanId: string;
  derivation?: { mode: NonNullable<RatePlan['adjustmentMode']>; value: NonNullable<RatePlan['adjustmentValue']> };
} {
  if (ratePlan.type === 'BASE') {
    return { basePlanId: ratePlan.id };
  }

  const base = ratePlan.derivedFrom;
  if (!base || base.type !== 'BASE') {
    throw new PricingEngineError(
      'Derived rate plan must reference a BASE (BAR) plan',
      'BASE_PLAN_NOT_FOUND',
    );
  }

  if (!ratePlan.adjustmentMode || ratePlan.adjustmentValue == null) {
    throw new PricingEngineError(
      'Derived rate plan is missing adjustment configuration',
      'INVALID_DERIVATION',
    );
  }

  return {
    basePlanId: base.id,
    derivation: {
      mode: ratePlan.adjustmentMode,
      value: ratePlan.adjustmentValue,
    },
  };
}

async function loadRatePlan(ratePlanId: string): Promise<ResolvedRatePlan> {
  const ratePlan = await prisma.ratePlan.findUnique({
    where: { id: ratePlanId },
    include: {
      roomRevenueCode: { select: { code: true } },
      derivedFrom: {
        include: {
          roomRevenueCode: { select: { code: true } },
        },
      },
    },
  });

  if (!ratePlan) {
    throw new PricingEngineError('Rate plan not found', 'RATE_PLAN_NOT_FOUND');
  }

  return ratePlan;
}

async function loadBarRates(
  basePlanId: string,
  roomTypeId: string,
  nights: Date[],
): Promise<Array<{ date: string; amount: import('@prisma/client').Prisma.Decimal }>> {
  if (nights.length === 0) {
    throw new PricingEngineError('Stay must include at least one night', 'RATE_NOT_LOADED');
  }

  const rows = await prisma.roomTypeRate.findMany({
    where: {
      ratePlanId: basePlanId,
      roomTypeId,
      date: { in: nights },
    },
    orderBy: { date: 'asc' },
  });

  const byDate = new Map(rows.map((r) => [dateKey(r.date), r]));

  return nights.map((night) => {
    const key = dateKey(night);
    const row = byDate.get(key);
    if (!row) {
      throw new PricingEngineError(
        `No BAR rate loaded for room type on ${key}`,
        'RATE_NOT_LOADED',
      );
    }
    return { date: key, amount: row.amount };
  });
}

async function resolveRoomRevenueCode(ratePlan: ResolvedRatePlan): Promise<string> {
  if (ratePlan.roomRevenueCode?.code) {
    return ratePlan.roomRevenueCode.code;
  }

  const fallback = await prisma.revenueCode.findFirst({
    where: { code: 'ROOM' },
    select: { code: true },
  });

  return fallback?.code ?? 'ROOM';
}

async function loadAddOnsForQuote(
  ratePlanId: string,
  optionalAddOnIds: string[],
  guests: number,
  nights: number,
) {
  const links = await prisma.ratePlanAddOn.findMany({
    where: { ratePlanId },
    include: {
      addOn: {
        include: { revenueCode: { select: { code: true } } },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const optionalSet = new Set(optionalAddOnIds);

  return links
    .filter((link) => {
      if (link.inclusion === 'INCLUDED') return true;
      return optionalSet.has(link.addOnId);
    })
    .map((link) => ({
      addOnCode: link.addOn.code,
      revenueCode: link.addOn.revenueCode.code,
      inclusion: link.inclusion,
      pricingUnit: link.addOn.pricingUnit,
      unitPrice: link.overridePrice ?? link.addOn.price,
    }));
}

/**
 * Calculate a stay quote on-the-fly: BAR calendar → derivation → add-ons.
 * Room Revenue and Add-on Revenue are strictly separated in the output.
 */
export async function quoteStay(input: QuoteStayInput): Promise<RateQuote> {
  const ratePlan = await loadRatePlan(input.ratePlanId);
  const { basePlanId, derivation } = resolveBasePlan(ratePlan);

  const nights = eachNight(input.checkInDate, input.checkOutDate);
  const nightCount = countNights(input.checkInDate, input.checkOutDate);
  const guests = Math.max(1, input.guests ?? 1);

  const barRates = await loadBarRates(basePlanId, input.roomTypeId, nights);
  const nightlyRates = buildNightlyRoomRates(barRates, derivation);

  const currencyRow = await prisma.roomTypeRate.findFirst({
    where: { ratePlanId: basePlanId, roomTypeId: input.roomTypeId },
    select: { currencyCode: true },
  });

  const addOns = await loadAddOnsForQuote(
    input.ratePlanId,
    input.optionalAddOnIds ?? [],
    guests,
    nightCount,
  );

  const roomRevenueCode = await resolveRoomRevenueCode(ratePlan);

  return assembleQuote({
    currency: currencyRow?.currencyCode ?? 'AZN',
    nights: nightCount,
    roomRevenueCode,
    nightlyRates,
    addOns,
    guests,
  });
}
