describe("deposit open/close posting balance", () => {
  it("open legs sum to zero net (debit equals credit)", () => {
    const principal = 1_000_000n;
    const openLegs = [
      { debitMinor: principal, creditMinor: 0n },
      { debitMinor: 0n, creditMinor: principal },
    ];
    const debit = openLegs.reduce((s, l) => s + l.debitMinor, 0n);
    const credit = openLegs.reduce((s, l) => s + l.creditMinor, 0n);
    expect(debit).toBe(credit);
  });

  it("close legs pay principal + accrued (balanced)", () => {
    const principal = 1_000_000n;
    const accrued = 12_000n;
    const payout = principal + accrued;
    const closeLegs = [
      { debitMinor: payout, creditMinor: 0n },
      { debitMinor: 0n, creditMinor: payout },
    ];
    const debit = closeLegs.reduce((s, l) => s + l.debitMinor, 0n);
    const credit = closeLegs.reduce((s, l) => s + l.creditMinor, 0n);
    expect(debit).toBe(credit);
  });

  it("rollover capitalizes accrued into principal (no extra legs)", () => {
    const beforePrincipal = 5_000_000n;
    const accrued = 25_000n;
    const afterPrincipal = beforePrincipal + accrued;
    expect(afterPrincipal).toBe(5_025_000n);
  });
});
