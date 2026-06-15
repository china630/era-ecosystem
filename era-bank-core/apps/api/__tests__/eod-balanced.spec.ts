/** Trial balance balance check used by EOD — pure helper for tests. */
export function isTrialBalanceBalanced(totalDebit: bigint, totalCredit: bigint): boolean {
  return totalDebit === totalCredit;
}

describe("EOD trial balance invariant", () => {
  it("accepts balanced totals", () => {
    expect(isTrialBalanceBalanced(1_000_000n, 1_000_000n)).toBe(true);
  });

  it("rejects drift", () => {
    expect(isTrialBalanceBalanced(1_000_000n, 999_999n)).toBe(false);
  });

  it("empty day is balanced", () => {
    expect(isTrialBalanceBalanced(0n, 0n)).toBe(true);
  });
});
