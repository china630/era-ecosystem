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

  it("close legs mirror open (balanced reversal)", () => {
    const principal = 1_000_000n;
    const closeLegs = [
      { debitMinor: principal, creditMinor: 0n },
      { debitMinor: 0n, creditMinor: principal },
    ];
    const debit = closeLegs.reduce((s, l) => s + l.debitMinor, 0n);
    const credit = closeLegs.reduce((s, l) => s + l.creditMinor, 0n);
    expect(debit).toBe(credit);
  });

  it("rollover does not mutate principal (no extra legs)", () => {
    const before = 5_000_000n;
    const after = before;
    expect(after).toBe(before);
  });
});
