import {
  applyBonusPercents,
  resolveBonusEligible,
  splitBonusBuckets,
} from "@/lib/doctor-bonus";

describe("Wave D doctor bonus (CLI-53)", () => {
  it("excludes in-quota (amountNet 0) and imported historical", () => {
    expect(resolveBonusEligible({ amountNet: 0 })).toBe(false);
    expect(resolveBonusEligible({ amountNet: 25 })).toBe(true);
    expect(
      resolveBonusEligible({ amountNet: 25, importedHistorical: true }),
    ).toBe(false);
  });

  it("splits IN_HOUSE vs WALK_IN bases", () => {
    const split = splitBonusBuckets([
      { patientOrigin: "IN_HOUSE", amountNet: 40 },
      { patientOrigin: "WALK_IN", amountNet: 10 },
      { patientOrigin: "IN_HOUSE", amountNet: 5 },
    ]);
    expect(split).toEqual({
      grandTotalInHouse: 45,
      grandTotalWalkIn: 10,
      grandTotal: 55,
    });
  });

  it("applies separate percents (default 0 → zero bonus)", () => {
    expect(
      applyBonusPercents({
        grandTotalInHouse: 100,
        grandTotalWalkIn: 50,
        percentInHouse: 0,
        percentWalkIn: 0,
      }),
    ).toEqual({ bonusInHouse: 0, bonusWalkIn: 0, bonusTotal: 0 });
    expect(
      applyBonusPercents({
        grandTotalInHouse: 100,
        grandTotalWalkIn: 50,
        percentInHouse: 10,
        percentWalkIn: 5,
      }),
    ).toEqual({ bonusInHouse: 10, bonusWalkIn: 2.5, bonusTotal: 12.5 });
  });
});
