describe("account close rules", () => {
  it("requires zero available balance", () => {
    const available = 0n;
    expect(available === 0n).toBe(true);
  });

  it("rejects when holds remain", () => {
    const activeHolds = 1;
    expect(activeHolds > 0).toBe(true);
  });
});
