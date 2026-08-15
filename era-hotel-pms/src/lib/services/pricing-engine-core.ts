import { Prisma } from '@prisma/client';
import type {
  AddOnInclusion,
  AddOnPricingUnit,
  RateAdjustmentMode,
} from '@prisma/client';

export type RateQuotePerNight = {
  date: string;
  barAmount: number;
  amount: number;
};

export type RateQuoteAddOnLine = {
  addOnCode: string;
  revenueCode: string;
  inclusion: AddOnInclusion;
  unit: AddOnPricingUnit;
  unitPrice: number;
  quantity: number;
  amount: number;
};

export type RateQuote = {
  currency: string;
  nights: number;
  room: {
    revenueCode: string;
    perNight: RateQuotePerNight[];
    total: number;
  };
  addOns: RateQuoteAddOnLine[];
  addOnTotal: number;
  grandTotal: number;
};

export type AddOnQuoteInput = {
  addOnCode: string;
  revenueCode: string;
  inclusion: AddOnInclusion;
  pricingUnit: AddOnPricingUnit;
  unitPrice: Prisma.Decimal | number;
};

export type AssembleQuoteInput = {
  currency: string;
  nights: number;
  roomRevenueCode: string;
  nightlyRates: Array<{ date: string; barAmount: Prisma.Decimal; amount: Prisma.Decimal }>;
  addOns: AddOnQuoteInput[];
  guests: number;
};

export type ChildPricingRow = {
  ageFrom: number;
  ageTo: number;
  discountPercent: number;
  amountOverride?: number | null;
  freeCount?: number;
};

export type ChildCountByAge = {
  count: number;
  representativeAge: number;
};

export type OccupancySupplementInput = {
  adults: number;
  baseOccupancy: number;
  extraAdultAmount: number | null | undefined;
  thirdAdultAmount: number | null | undefined;
  extraBeds?: number;
  extraBedAmount?: number | null | undefined;
};

/** Nafta TZ defaults when ChildPricingMatrix is empty. */
export const DEFAULT_CHILD_PRICING_MATRIX: ChildPricingRow[] = [
  { ageFrom: 0, ageTo: 6, discountPercent: 100, freeCount: 1 },
  { ageFrom: 7, ageTo: 11, discountPercent: 50, freeCount: 0 },
  { ageFrom: 12, ageTo: 17, discountPercent: 0, freeCount: 0 },
];

export function resolveChildBand(
  age: number,
  matrix: ChildPricingRow[],
): ChildPricingRow | undefined {
  const rows = matrix.length > 0 ? matrix : DEFAULT_CHILD_PRICING_MATRIX;
  return rows.find((row) => age >= row.ageFrom && age <= row.ageTo);
}

export function resolveChildDiscountPercent(
  age: number,
  matrix: ChildPricingRow[],
): number {
  return resolveChildBand(age, matrix)?.discountPercent ?? 0;
}

/**
 * Extra adults / extra beds on top of base room nightly.
 * baseOccupancy adults are included in the room rate (typically 1).
 * 2nd adult uses extraAdultAmount; 3rd+ prefer thirdAdultAmount else extraAdultAmount.
 */
export function computeOccupancyNightlySupplement(
  input: OccupancySupplementInput,
): Prisma.Decimal {
  const adults = Math.max(0, input.adults);
  const base = Math.max(1, input.baseOccupancy || 1);
  const extras = Math.max(0, adults - base);
  let supplement = ZERO;

  if (extras > 0) {
    const second = toDecimal(input.extraAdultAmount ?? 0);
    const thirdPlus = toDecimal(
      input.thirdAdultAmount ?? input.extraAdultAmount ?? 0,
    );
    // First extra adult (adult # base+1)
    supplement = supplement.plus(second);
    if (extras > 1) {
      supplement = supplement.plus(thirdPlus.mul(extras - 1));
    }
  }

  const beds = Math.max(0, input.extraBeds ?? 0);
  if (beds > 0 && input.extraBedAmount != null) {
    supplement = supplement.plus(toDecimal(input.extraBedAmount).mul(beds));
  }

  return roundMoney(supplement);
}

/**
 * Child nightly addon on top of adult room rate.
 * - freeCount: first N in band are free
 * - when useAbsolutePricing and amountOverride set: charge that AZN per paying child
 * - else: discountPercent waiver of adult nightly (100 = free)
 */
export function computeChildNightlyAddon(
  adultNightly: Prisma.Decimal | number,
  children: ChildCountByAge[],
  matrix: ChildPricingRow[],
  options?: { useAbsolutePricing?: boolean },
): Prisma.Decimal {
  const adult = toDecimal(adultNightly);
  let addon = ZERO;
  const useAbsolute = options?.useAbsolutePricing === true;

  for (const group of children) {
    if (group.count <= 0) continue;
    const band = resolveChildBand(group.representativeAge, matrix);
    const free = Math.min(group.count, Math.max(0, band?.freeCount ?? 0));
    const paying = group.count - free;
    if (paying <= 0) continue;

    if (
      useAbsolute &&
      band?.amountOverride != null &&
      Number.isFinite(band.amountOverride)
    ) {
      addon = addon.plus(toDecimal(band.amountOverride).mul(paying));
      continue;
    }

    const discount = band?.discountPercent ?? 0;
    const payFactor = HUNDRED.minus(toDecimal(discount)).div(HUNDRED);
    const childRate = adult.mul(payFactor);
    addon = addon.plus(childRate.mul(paying));
  }

  return roundMoney(addon);
}

/** Apply yield adjustment percent to a nightly amount. */
export function applyLoadBasedAdjustment(
  nightly: Prisma.Decimal | number,
  adjustmentPercent: number,
): Prisma.Decimal {
  if (!adjustmentPercent) return roundMoney(toDecimal(nightly));
  const base = toDecimal(nightly);
  return roundMoney(base.mul(HUNDRED.plus(toDecimal(adjustmentPercent)).div(HUNDRED)));
}

/** Map reservation child count fields to representative ages. */
export function reservationChildGroups(input: {
  children1_0: number;
  children5_2: number;
  children11_6: number;
}): ChildCountByAge[] {
  return [
    { count: input.children1_0, representativeAge: 1 },
    { count: input.children5_2, representativeAge: 3 },
    { count: input.children11_6, representativeAge: 8 },
  ];
}

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

/** Apply a single-step derivation formula to a BAR nightly rate. */
export function applyDerivation(
  barNightly: Prisma.Decimal | number,
  mode: RateAdjustmentMode,
  value: Prisma.Decimal | number,
): Prisma.Decimal {
  const bar = toDecimal(barNightly);
  const adjustment = toDecimal(value);

  let result: Prisma.Decimal;
  if (mode === 'PERCENT') {
    result = bar.mul(adjustment.div(HUNDRED).plus(1));
  } else {
    result = bar.plus(adjustment);
  }

  const rounded = roundMoney(result);
  return Prisma.Decimal.max(ZERO, rounded);
}

/** Compute add-on amount from unit price, pricing unit, nights, and guest count. */
export function computeAddOnAmount(
  unitPrice: Prisma.Decimal | number,
  unit: AddOnPricingUnit,
  nights: number,
  guests: number,
): Prisma.Decimal {
  const price = toDecimal(unitPrice);
  const safeNights = Math.max(1, nights);
  const safeGuests = Math.max(1, guests);

  switch (unit) {
    case 'PER_STAY':
      return roundMoney(price);
    case 'PER_NIGHT':
      return roundMoney(price.mul(safeNights));
    case 'PER_GUEST':
      return roundMoney(price.mul(safeGuests));
    case 'PER_GUEST_NIGHT':
      return roundMoney(price.mul(safeGuests).mul(safeNights));
    default: {
      const _exhaustive: never = unit;
      return _exhaustive;
    }
  }
}

/** Compute quantity multiplier for an add-on line (for display / folio qty). */
export function computeAddOnQuantity(
  unit: AddOnPricingUnit,
  nights: number,
  guests: number,
): number {
  const safeNights = Math.max(1, nights);
  const safeGuests = Math.max(1, guests);

  switch (unit) {
    case 'PER_STAY':
      return 1;
    case 'PER_NIGHT':
      return safeNights;
    case 'PER_GUEST':
      return safeGuests;
    case 'PER_GUEST_NIGHT':
      return safeGuests * safeNights;
    default: {
      const _exhaustive: never = unit;
      return _exhaustive;
    }
  }
}

/** Build per-night room lines with optional derivation applied per night. */
export function buildNightlyRoomRates(
  barRates: Array<{ date: string; amount: Prisma.Decimal }>,
  derivation?: { mode: RateAdjustmentMode; value: Prisma.Decimal },
): Array<{ date: string; barAmount: Prisma.Decimal; amount: Prisma.Decimal }> {
  return barRates.map(({ date, amount: barAmount}) => {
    const amount = derivation
      ? applyDerivation(barAmount, derivation.mode, derivation.value)
      : roundMoney(barAmount);
    return { date, barAmount: roundMoney(barAmount), amount };
  });
}

/** Assemble a full quote with strictly separated room and add-on revenue. */
export function assembleQuote(input: AssembleQuoteInput): RateQuote {
  const roomTotal = input.nightlyRates.reduce(
    (sum, night) => sum.plus(night.amount),
    ZERO,
  );

  const addOnLines: RateQuoteAddOnLine[] = input.addOns.map((addOn) => {
    const unitPrice = toDecimal(addOn.unitPrice);
    const amount = computeAddOnAmount(
      unitPrice,
      addOn.pricingUnit,
      input.nights,
      input.guests,
    );
    const quantity = computeAddOnQuantity(addOn.pricingUnit, input.nights, input.guests);

    return {
      addOnCode: addOn.addOnCode,
      revenueCode: addOn.revenueCode,
      inclusion: addOn.inclusion,
      unit: addOn.pricingUnit,
      unitPrice: decimalToNumber(unitPrice),
      quantity,
      amount: decimalToNumber(amount),
    };
  });

  const addOnTotal = addOnLines.reduce(
    (sum, line) => sum + line.amount,
    0,
  );

  const roomTotalNum = decimalToNumber(roundMoney(roomTotal));

  return {
    currency: input.currency,
    nights: input.nights,
    room: {
      revenueCode: input.roomRevenueCode,
      perNight: input.nightlyRates.map((night) => ({
        date: night.date,
        barAmount: decimalToNumber(night.barAmount),
        amount: decimalToNumber(night.amount),
      })),
      total: roomTotalNum,
    },
    addOns: addOnLines,
    addOnTotal,
    grandTotal: roomTotalNum + addOnTotal,
  };
}
