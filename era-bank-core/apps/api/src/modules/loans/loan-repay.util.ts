import { InstallmentStatus } from "@era/bank-core-database";

export type RepayInstallmentInput = {
  id: string;
  sequenceNo: number;
  dueDate: Date;
  principalMinor: bigint;
  interestMinor: bigint;
  paidPrincipalMinor: bigint;
  paidInterestMinor: bigint;
  status: InstallmentStatus | string;
};

export type InstallmentPatch = {
  id: string;
  paidPrincipalMinor: bigint;
  paidInterestMinor: bigint;
  status: InstallmentStatus;
  paidAt: Date | null;
  markOverdue: boolean;
};

export type AllocateRepaymentResult = {
  penaltyTotal: bigint;
  principalTotal: bigint;
  interestTotal: bigint;
  remainingUnallocated: bigint;
  patches: InstallmentPatch[];
};

const TERMINAL = new Set<string>([
  InstallmentStatus.PAID,
  InstallmentStatus.WAIVED,
]);

export type RepayWaterfallStep = "PENALTY" | "INTEREST" | "PRINCIPAL";

export const DEFAULT_REPAY_WATERFALL: readonly RepayWaterfallStep[] = [
  "PENALTY",
  "INTEREST",
  "PRINCIPAL",
] as const;

const WATERFALL_STEPS = new Set<string>(["PENALTY", "INTEREST", "PRINCIPAL"]);

/** Read `repayWaterfall` string[] from ProductTemplate.paramsJson when present. */
export function repayWaterfallFromParams(
  paramsJson: unknown,
): readonly RepayWaterfallStep[] {
  if (!paramsJson || typeof paramsJson !== "object" || Array.isArray(paramsJson)) {
    return DEFAULT_REPAY_WATERFALL;
  }
  const raw = (paramsJson as Record<string, unknown>).repayWaterfall;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_REPAY_WATERFALL;
  const steps = raw
    .map((s) => String(s).toUpperCase())
    .filter((s): s is RepayWaterfallStep => WATERFALL_STEPS.has(s));
  return steps.length > 0 ? steps : DEFAULT_REPAY_WATERFALL;
}

export type AllocateRepaymentOptions = {
  /** Loan-level accrued penalty — taken when waterfall includes PENALTY. */
  accruedPenaltyMinor?: bigint;
  /** Product-configurable order; default penalty → interest → principal. */
  waterfall?: readonly RepayWaterfallStep[];
};

/**
 * Waterfall over accrued penalty then unpaid installments by sequenceNo.
 * Default order: penalty → interest → principal (product params may override).
 */
export function allocateRepayment(
  installments: RepayInstallmentInput[],
  amountMinor: bigint,
  asOf: Date = new Date(),
  options: AllocateRepaymentOptions = {},
): AllocateRepaymentResult {
  let remaining = amountMinor < 0n ? 0n : amountMinor;
  const patches: InstallmentPatch[] = [];
  let principalTotal = 0n;
  let interestTotal = 0n;
  let penaltyTotal = 0n;

  const waterfall = options.waterfall?.length
    ? options.waterfall
    : DEFAULT_REPAY_WATERFALL;

  const penaltyDue =
    options.accruedPenaltyMinor != null && options.accruedPenaltyMinor > 0n
      ? options.accruedPenaltyMinor
      : 0n;
  if (waterfall.includes("PENALTY") && penaltyDue > 0n && remaining > 0n) {
    const take = remaining < penaltyDue ? remaining : penaltyDue;
    penaltyTotal = take;
    remaining -= take;
  }

  const ordered = [...installments]
    .filter((i) => !TERMINAL.has(String(i.status)))
    .sort((a, b) => a.sequenceNo - b.sequenceNo);

  const interestFirst =
    waterfall.indexOf("INTEREST") <= waterfall.indexOf("PRINCIPAL");

  for (const inst of ordered) {
    if (remaining <= 0n) break;

    let paidInterest = inst.paidInterestMinor;
    let paidPrincipal = inst.paidPrincipalMinor;

    const interestDue =
      inst.interestMinor > paidInterest
        ? inst.interestMinor - paidInterest
        : 0n;
    const principalDue =
      inst.principalMinor > paidPrincipal
        ? inst.principalMinor - paidPrincipal
        : 0n;

    const applyInterest = () => {
      if (interestDue > 0n && remaining > 0n && waterfall.includes("INTEREST")) {
        const take = remaining < interestDue ? remaining : interestDue;
        paidInterest += take;
        interestTotal += take;
        remaining -= take;
      }
    };
    const applyPrincipal = () => {
      if (
        principalDue > 0n &&
        remaining > 0n &&
        waterfall.includes("PRINCIPAL")
      ) {
        const dueLeft =
          inst.principalMinor > paidPrincipal
            ? inst.principalMinor - paidPrincipal
            : 0n;
        const take = remaining < dueLeft ? remaining : dueLeft;
        paidPrincipal += take;
        principalTotal += take;
        remaining -= take;
      }
    };

    if (interestFirst) {
      applyInterest();
      applyPrincipal();
    } else {
      applyPrincipal();
      applyInterest();
    }

    const fullyPaid =
      paidInterest >= inst.interestMinor && paidPrincipal >= inst.principalMinor;
    let status: InstallmentStatus = fullyPaid
      ? InstallmentStatus.PAID
      : (inst.status as InstallmentStatus);
    let markOverdue = false;
    if (!fullyPaid && inst.dueDate.getTime() < asOf.getTime()) {
      status = InstallmentStatus.OVERDUE;
      markOverdue = true;
    } else if (!fullyPaid && status === InstallmentStatus.OVERDUE) {
      // keep overdue until paid
    } else if (!fullyPaid && status !== InstallmentStatus.DUE) {
      status = InstallmentStatus.SCHEDULED;
    }

    patches.push({
      id: inst.id,
      paidPrincipalMinor: paidPrincipal,
      paidInterestMinor: paidInterest,
      status: fullyPaid ? InstallmentStatus.PAID : status,
      paidAt: fullyPaid ? asOf : null,
      markOverdue,
    });
  }

  return {
    penaltyTotal,
    principalTotal,
    interestTotal,
    remainingUnallocated: remaining,
    patches,
  };
}
