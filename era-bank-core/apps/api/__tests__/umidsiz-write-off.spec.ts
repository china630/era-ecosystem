import {
  assertUmidsizWriteOffSoD,
  buildUmidsizWriteOffLegs,
  isUmidsizCategory,
} from "../src/modules/risk/umidsiz-write-off.util";

describe("umidsiz write-off util (P0-3)", () => {
  it("rejects same maker and checker (SoD negative)", () => {
    expect(() => assertUmidsizWriteOffSoD("risk-a", "risk-a")).toThrow(
      /segregation/i,
    );
  });

  it("allows distinct maker and checker", () => {
    expect(() => assertUmidsizWriteOffSoD("risk-a", "risk-b")).not.toThrow();
  });

  it("rejects system actors as maker or checker", () => {
    expect(() => assertUmidsizWriteOffSoD("risk-system", "risk-b")).toThrow(
      /system actors/i,
    );
    expect(() => assertUmidsizWriteOffSoD("risk-a", "service")).toThrow(
      /system actors/i,
    );
    expect(() => assertUmidsizWriteOffSoD("eod-system", "system")).toThrow(
      /system actors/i,
    );
  });

  it("rejects empty maker or checker", () => {
    expect(() => assertUmidsizWriteOffSoD("", "risk-b")).toThrow(/required/i);
    expect(() => assertUmidsizWriteOffSoD("risk-a", "  ")).toThrow(/required/i);
  });

  it("recognizes UMIDSIZ category", () => {
    expect(isUmidsizCategory("UMIDSIZ")).toBe(true);
    expect(isUmidsizCategory("ümidsiz")).toBe(false);
    expect(isUmidsizCategory("TEHLUKELI")).toBe(false);
  });

  it("builds debit allowance / credit loan asset legs", () => {
    const legs = buildUmidsizWriteOffLegs({
      allowanceGlId: "gl-allow",
      loanGlId: "gl-loan",
      branchId: "hq",
      amountMinor: 50_00n,
      currency: "AZN",
    });
    expect(legs).toHaveLength(2);
    expect(legs[0].glAccountId).toBe("gl-allow");
    expect(legs[0].debitMinor).toBe(50_00n);
    expect(legs[1].glAccountId).toBe("gl-loan");
    expect(legs[1].creditMinor).toBe(50_00n);
  });

  it("rejects non-positive amount", () => {
    expect(() =>
      buildUmidsizWriteOffLegs({
        allowanceGlId: "a",
        loanGlId: "b",
        branchId: "hq",
        amountMinor: 0n,
        currency: "AZN",
      }),
    ).toThrow(/positive/i);
  });
});
