import fs from "node:fs";
import path from "node:path";

const root = path.resolve("apps/api/src");
const write = (rel, content) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

write(
  "common/bank-error-codes.ts",
  `export const BankErrorCode = {
  EOD_LOCKED: "EOD_LOCKED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  SOD_SELF_APPROVE: "SOD_SELF_APPROVE",
  LITE_NOT_DEEP: "LITE_NOT_DEEP",
  TARIFF_NOT_FOUND: "TARIFF_NOT_FOUND",
  TARIFF_INACTIVE: "TARIFF_INACTIVE",
  MOVEMENT_ALREADY_POSTED: "MOVEMENT_ALREADY_POSTED",
  CASE_NOT_FOUND: "CASE_NOT_FOUND",
  TRADE_INVALID_STATE: "TRADE_INVALID_STATE",
  STANDING_ORDER_NOT_DUE: "STANDING_ORDER_NOT_DUE",
} as const;

export type BankErrorCode = (typeof BankErrorCode)[keyof typeof BankErrorCode];
`,
);

write(
  "common/idempotency.ts",
  `import { BadRequestException } from "@nestjs/common";
import { BankErrorCode } from "./bank-error-codes";

export function assertIdempotencyKey(key: string | undefined | null): string {
  const trimmed = key?.trim();
  if (!trimmed || trimmed.length < 8) {
    throw new BadRequestException({
      code: BankErrorCode.IDEMPOTENCY_CONFLICT,
      message: "idempotencyKey required (min 8 chars)",
    });
  }
  return trimmed;
}
`,
);

write(
  "modules/fee/fee-posting.util.ts",
  `import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildFeeAssessLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  debitAccountId: string;
  debitGlAccountId: string;
  feeIncomeGlId: string;
  useCashVault?: boolean;
  cashVaultGlId?: string;
}): PostingLegInput[] {
  if (input.useCashVault && input.cashVaultGlId) {
    return [
      {
        glAccountId: input.cashVaultGlId,
        branchId: input.branchId,
        debitMinor: input.amountMinor,
        creditMinor: 0n,
        currency: input.currency,
      },
      {
        glAccountId: input.feeIncomeGlId,
        branchId: input.branchId,
        debitMinor: 0n,
        creditMinor: input.amountMinor,
        currency: input.currency,
      },
    ];
  }
  return [
    {
      accountId: input.debitAccountId,
      glAccountId: input.debitGlAccountId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.feeIncomeGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}
`,
);

write(
  "modules/cash/cash-posting.util.ts",
  `import { CashMovementKind } from "@era/bank-core-database";
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
`,
);

write(
  "modules/collections/collections-posting.util.ts",
  `import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildRecoveryLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  recoveryIncomeGlId: string;
  nplWorkoutGlId: string;
  creditAccountId?: string;
  creditGlAccountId?: string;
}): PostingLegInput[] {
  const legs: PostingLegInput[] = [
    {
      glAccountId: input.nplWorkoutGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
    {
      glAccountId: input.recoveryIncomeGlId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
  ];
  if (input.creditAccountId && input.creditGlAccountId) {
    legs.unshift({
      accountId: input.creditAccountId,
      glAccountId: input.creditGlAccountId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    });
    legs[1].creditMinor = input.amountMinor;
    legs[2].debitMinor = input.amountMinor;
  }
  return legs;
}
`,
);

write(
  "modules/trade/trade-posting.util.ts",
  `import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildLcIssueContingentLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  contingentAssetGlId: string;
  contingentLiabilityGlId: string;
}): PostingLegInput[] {
  return [
    {
      glAccountId: input.contingentAssetGlId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.contingentLiabilityGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}
`,
);

write(
  "modules/payments/standing-order-posting.util.ts",
  `import type { PostingLegInput } from "../../kernel/posting-engine/posting-engine.types";

export function buildStandingOrderRunLegs(input: {
  amountMinor: bigint;
  currency: string;
  branchId: string;
  fromAccountId: string;
  fromGlAccountId: string;
  clearingGlId: string;
}): PostingLegInput[] {
  return [
    {
      accountId: input.fromAccountId,
      glAccountId: input.fromGlAccountId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.clearingGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}
`,
);

console.log("Scaffold utils done — run main module writer separately");
