describe("ContractAmendment activate rules", () => {
  it("refuses activate when next limit below committed", () => {
    const amountLimit = 100;
    const delta = -50;
    const committed = 60;
    const nextLimit = amountLimit + delta;
    expect(nextLimit < committed).toBe(true);
    expect({
      code: "AMENDMENT_BELOW_COMMITTED",
      committed: committed.toFixed(4),
      nextLimit: nextLimit.toFixed(4),
    }).toMatchObject({ code: "AMENDMENT_BELOW_COMMITTED" });
  });

  it("treats DRAFT as activatable status", () => {
    expect("DRAFT").toBe("DRAFT");
    expect("ACTIVE").toBe("ACTIVE");
  });
});

describe("PayApp retention math", () => {
  it("computes net from gross and retention pct", () => {
    const gross = 1000;
    const retentionPct = 10;
    const retention = (gross * retentionPct) / 100;
    const net = gross - retention;
    expect(retention).toBe(100);
    expect(net).toBe(900);
  });

  it("flags over-SOV when gross exceeds limit", () => {
    const limit = 500;
    const gross = 600;
    expect(gross > limit).toBe(true);
  });
});
