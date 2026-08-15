import { BadRequestException } from "@nestjs/common";
import { HoldReason } from "@era/bank-core-database";

/** Available = ledger − active holds + overdraft limit. */
export function computeAvailableBalance(input: {
  ledgerBalanceMinor: bigint;
  overdraftLimitMinor: bigint;
  activeHoldMinor: bigint;
}): bigint {
  return (
    input.ledgerBalanceMinor - input.activeHoldMinor + input.overdraftLimitMinor
  );
}

export function sumActiveHoldMinor(
  holds: Array<{ amountMinor: bigint; status: string }>,
): bigint {
  return holds
    .filter((h) => h.status === "ACTIVE")
    .reduce((sum, h) => sum + h.amountMinor, 0n);
}

export type PackageWaiverType = "FULL" | "PERCENT" | "FIXED_MINOR";

export function applyPackageWaiver(
  baseAmountMinor: bigint,
  waiverType: string,
  waiverValue: bigint | null | undefined,
): bigint {
  switch (waiverType as PackageWaiverType) {
    case "FULL":
      return 0n;
    case "PERCENT": {
      const pct = waiverValue ?? 0n;
      if (pct < 0n || pct > 100n) {
        throw new BadRequestException("PERCENT waiverValue must be 0–100");
      }
      return (baseAmountMinor * (100n - pct)) / 100n;
    }
    case "FIXED_MINOR": {
      const fixed = waiverValue ?? 0n;
      const next = baseAmountMinor - fixed;
      return next > 0n ? next : 0n;
    }
    default:
      throw new BadRequestException(`Unknown waiverType ${waiverType}`);
  }
}

export function assertOverdraftAllowed(
  overdraftLimitMinor: bigint,
  productOverdraftAllowed: boolean | undefined,
  hasProductTemplate: boolean,
): void {
  if (overdraftLimitMinor <= 0n) return;
  if (!hasProductTemplate) return;
  if (productOverdraftAllowed === false) {
    throw new BadRequestException(
      "Overdraft limit not allowed for this product template",
    );
  }
}

export const LEGAL_ARREST_HOLD_REASON = HoldReason.LEGAL_ARREST;

export function fxRevalEmptyResult() {
  return { posted: 0, currencies: [] as string[], pnlMinor: "0", details: [] };
}
