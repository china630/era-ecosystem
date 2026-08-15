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
  principalTotal: bigint;
  interestTotal: bigint;
  remainingUnallocated: bigint;
  patches: InstallmentPatch[];
};

const TERMINAL = new Set<string>([
  InstallmentStatus.PAID,
  InstallmentStatus.WAIVED,
]);

/**
 * Waterfall: unpaid installments by sequenceNo — interest remaining, then principal.
 */
export function allocateRepayment(
  installments: RepayInstallmentInput[],
  amountMinor: bigint,
  asOf: Date = new Date(),
): AllocateRepaymentResult {
  let remaining = amountMinor < 0n ? 0n : amountMinor;
  const patches: InstallmentPatch[] = [];
  let principalTotal = 0n;
  let interestTotal = 0n;

  const ordered = [...installments]
    .filter((i) => !TERMINAL.has(String(i.status)))
    .sort((a, b) => a.sequenceNo - b.sequenceNo);

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

    if (interestDue > 0n && remaining > 0n) {
      const take = remaining < interestDue ? remaining : interestDue;
      paidInterest += take;
      interestTotal += take;
      remaining -= take;
    }
    if (principalDue > 0n && remaining > 0n) {
      const take = remaining < principalDue ? remaining : principalDue;
      paidPrincipal += take;
      principalTotal += take;
      remaining -= take;
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
    principalTotal,
    interestTotal,
    remainingUnallocated: remaining,
    patches,
  };
}
