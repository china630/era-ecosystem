import { CashMovementKind } from "@era/bank-core-database";
import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildCashMovementLegs(input: {
  kind: CashMovementKind;
  amountMinor: bigint;
  currency: string;
  branchId: string;
  cashVaultGlId: string;
  tellerTillGlId: string;
}): PostingLegInput[] {
  const { amountMinor, currency, branchId, cashVaultGlId, tellerTillGlId } = input;
  const vaultLeg = (debit: bigint, credit: bigint): PostingLegInput => ({
    glAccountId: cashVaultGlId,
    branchId,
    debitMinor: debit,
    creditMinor: credit,
    currency,
  });
  const tillLeg = (debit: bigint, credit: bigint): PostingLegInput => ({
    glAccountId: tellerTillGlId,
    branchId,
    debitMinor: debit,
    creditMinor: credit,
    currency,
  });

  switch (input.kind) {
    case CashMovementKind.TILL_TO_VAULT:
      return [vaultLeg(amountMinor, 0n), tillLeg(0n, amountMinor)];
    case CashMovementKind.VAULT_TO_TILL:
      return [tillLeg(amountMinor, 0n), vaultLeg(0n, amountMinor)];
    case CashMovementKind.CIT_IN:
      return [vaultLeg(amountMinor, 0n), tillLeg(0n, amountMinor)];
    case CashMovementKind.CIT_OUT:
      return [tillLeg(amountMinor, 0n), vaultLeg(0n, amountMinor)];
    case CashMovementKind.TELLER_IN:
      return [tillLeg(amountMinor, 0n), vaultLeg(0n, amountMinor)];
    case CashMovementKind.TELLER_OUT:
      return [vaultLeg(amountMinor, 0n), tillLeg(0n, amountMinor)];
    default:
      return [vaultLeg(amountMinor, 0n), tillLeg(0n, amountMinor)];
  }
}
