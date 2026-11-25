/** System / EOD actors cannot act as maker or checker for ümidsiz write-off. */
export const UMIDSIZ_SYSTEM_ACTORS = new Set([
  "risk-system",
  "service",
  "eod-system",
  "system",
]);

/** Negative SoD: checker must differ from maker; neither may be a system actor (P0-3). */
export function assertUmidsizWriteOffSoD(
  makerUserId: string,
  checkerUserId: string,
): void {
  const maker = makerUserId?.trim() ?? "";
  const checker = checkerUserId?.trim() ?? "";
  if (!maker || !checker) {
    throw new Error("Maker and checker user ids are required for ümidsiz write-off");
  }
  if (UMIDSIZ_SYSTEM_ACTORS.has(maker) || UMIDSIZ_SYSTEM_ACTORS.has(checker)) {
    throw new Error(
      "System actors (risk-system/service/eod) cannot be maker or checker on ümidsiz write-off",
    );
  }
  if (maker === checker) {
    throw new Error(
      "Maker cannot approve own ümidsiz write-off (segregation of duties)",
    );
  }
}

/**
 * CBAR ümidsiz write-off legs: charge the prudential allowance and
 * remove the loan asset from the book (ADR bank P0-3).
 */
export function buildUmidsizWriteOffLegs(input: {
  allowanceGlId: string;
  loanGlId: string;
  branchId: string;
  amountMinor: bigint;
  currency: string;
}) {
  if (input.amountMinor <= 0n) {
    throw new Error("Write-off amount must be positive");
  }
  return [
    {
      glAccountId: input.allowanceGlId,
      branchId: input.branchId,
      debitMinor: input.amountMinor,
      creditMinor: 0n,
      currency: input.currency,
    },
    {
      glAccountId: input.loanGlId,
      branchId: input.branchId,
      debitMinor: 0n,
      creditMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}

export function isUmidsizCategory(category: string | null | undefined): boolean {
  return String(category ?? "").toUpperCase() === "UMIDSIZ";
}
