/**
 * Pure helpers for agency commission payable (ADR hotel-agency-commission-payable).
 * No folio writes — commission is AP, not City Ledger AR.
 */

export type CommissionSliceInput = {
  periodKey: string;
  commercialPeriodId: string | null;
  agencyId: string;
  fromDate: Date;
  toDate: Date;
  commissionBasis: 'GROSS' | 'NET';
  commissionPercent: number;
};

export type RoomChargeSlice = {
  businessDate: Date;
  amount: number;
  qty: number;
  systemRole: string | null;
  isRoomRevenueCode: boolean;
};

export type ComputedCommissionLine = CommissionSliceInput & {
  revenueBase: number;
  amount: number;
  status: 'ACCRUED' | 'SKIPPED_NET';
};

/** Stay-night / ROOM roles only (P0). City tax and extras excluded. */
export function isCommissionRevenueBase(charge: {
  systemRole: string | null;
  isRoomRevenueCode: boolean;
}): boolean {
  if (charge.systemRole === 'ROOM' || charge.systemRole === 'PKG' || charge.systemRole === 'RATE_ADJ') {
    return true;
  }
  if (charge.systemRole == null && charge.isRoomRevenueCode) return true;
  return false;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeCommissionAmount(
  revenueBase: number,
  percent: number,
  basis: 'GROSS' | 'NET',
): { amount: number; status: 'ACCRUED' | 'SKIPPED_NET' } {
  if (basis === 'NET' || percent <= 0 || revenueBase <= 0) {
    return {
      amount: 0,
      status: basis === 'NET' ? 'SKIPPED_NET' : 'ACCRUED',
    };
  }
  return {
    amount: roundMoney((revenueBase * percent) / 100),
    status: 'ACCRUED',
  };
}

export function chargeInPeriod(
  businessDate: Date,
  fromDate: Date,
  toDate: Date,
): boolean {
  const t = businessDate.getTime();
  return t >= fromDate.getTime() && t <= toDate.getTime();
}

export function sumRevenueBaseForPeriod(
  charges: RoomChargeSlice[],
  fromDate: Date,
  toDate: Date,
): number {
  let sum = 0;
  for (const c of charges) {
    if (!isCommissionRevenueBase(c)) continue;
    if (!chargeInPeriod(c.businessDate, fromDate, toDate)) continue;
    sum += c.amount * c.qty;
  }
  return roundMoney(sum);
}

export function buildComputedLines(
  slices: CommissionSliceInput[],
  charges: RoomChargeSlice[],
): ComputedCommissionLine[] {
  const out: ComputedCommissionLine[] = [];
  for (const slice of slices) {
    if (!slice.agencyId) continue;
    const revenueBase = sumRevenueBaseForPeriod(charges, slice.fromDate, slice.toDate);
    const { amount, status } = computeCommissionAmount(
      revenueBase,
      slice.commissionPercent,
      slice.commissionBasis,
    );
    // No agency % and no revenue → skip creating a line unless NET (audit trail).
    if (status === 'ACCRUED' && amount <= 0 && revenueBase <= 0 && slice.commissionPercent <= 0) {
      continue;
    }
    if (status === 'ACCRUED' && slice.commissionPercent <= 0) continue;
    out.push({ ...slice, revenueBase, amount, status });
  }
  return out;
}

/** Forecast: nights × nightly rate × % (GROSS only). */
export function forecastCommissionAmount(
  nights: number,
  nightlyRate: number,
  percent: number,
  basis: 'GROSS' | 'NET',
): number {
  if (basis === 'NET' || nights <= 0 || nightlyRate <= 0 || percent <= 0) return 0;
  return roundMoney(((nights * nightlyRate) * percent) / 100);
}
