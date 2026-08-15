describe("pricing exception SoD", () => {
  function assertCheckerNotMaker(makerUserId: string, checkerUserId: string) {
    if (makerUserId === checkerUserId) {
      throw new Error("Maker cannot approve own pricing exception");
    }
  }

  it("rejects same maker/checker", () => {
    expect(() => assertCheckerNotMaker("ops-a", "ops-a")).toThrow(/Maker cannot/);
  });

  it("allows different checker", () => {
    expect(() => assertCheckerNotMaker("ops-a", "ops-b")).not.toThrow();
  });
});
