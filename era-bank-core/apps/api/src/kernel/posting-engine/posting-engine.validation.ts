import { BadRequestException } from "@nestjs/common";
import type { CurrencyTotals, PostingLegInput } from "./posting-engine.types";

export function validateLegShape(leg: PostingLegInput): void {
  const hasDebit = leg.debitMinor > 0n;
  const hasCredit = leg.creditMinor > 0n;
  if (hasDebit === hasCredit) {
    throw new BadRequestException("Each leg must have exactly one of debit or credit non-zero");
  }
  if (leg.debitMinor < 0n || leg.creditMinor < 0n) {
    throw new BadRequestException("Debit and credit must be non-negative");
  }
  if (!leg.currency?.trim()) {
    throw new BadRequestException("Leg currency is required");
  }
  if (!leg.glAccountId?.trim() || !leg.branchId?.trim()) {
    throw new BadRequestException("GL account and branch are required on each leg");
  }
}

export function sumByCurrency(legs: PostingLegInput[]): CurrencyTotals[] {
  const map = new Map<string, { debitMinor: bigint; creditMinor: bigint }>();
  for (const leg of legs) {
    const row = map.get(leg.currency) ?? { debitMinor: 0n, creditMinor: 0n };
    row.debitMinor += leg.debitMinor;
    row.creditMinor += leg.creditMinor;
    map.set(leg.currency, row);
  }
  return [...map.entries()].map(([currency, totals]) => ({
    currency,
    debitMinor: totals.debitMinor,
    creditMinor: totals.creditMinor,
  }));
}

export function assertBalancedLegs(legs: PostingLegInput[]): void {
  for (const leg of legs) validateLegShape(leg);
  for (const { currency, debitMinor, creditMinor } of sumByCurrency(legs)) {
    if (debitMinor !== creditMinor) {
      throw new BadRequestException(
        `Unbalanced transaction for ${currency}: debit=${debitMinor} credit=${creditMinor}`,
      );
    }
  }
}

export function mirrorLeg(leg: PostingLegInput): PostingLegInput {
  return {
    ...leg,
    debitMinor: leg.creditMinor,
    creditMinor: leg.debitMinor,
  };
}
