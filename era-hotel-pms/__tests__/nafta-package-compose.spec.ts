import {
  composeNaftaPackageNightlySell,
  composeNaftaPackageNightlySellBreakdown,
  halfOcc2,
} from "@/lib/services/nafta-package-compose.service";

describe("composeNaftaPackageNightlySell", () => {
  it("Premium + Standart → 193+96", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-PREMIUM", "PKG-STANDART"]),
    ).toBe(289);
  });

  it("Dermo + Standart → 180+96", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-DERMO", "PKG-STANDART"]),
    ).toBe(276);
  });

  it("Premium + Detoks → 193+160", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-PREMIUM", "PKG-DETOKS"]),
    ).toBe(353);
  });

  it("Dermo + Detoks → 180+160", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-DERMO", "PKG-DETOKS"]),
    ).toBe(340);
  });

  it("two Standart → occ2 239", () => {
    expect(
      composeNaftaPackageNightlySell(["PKG-STANDART", "PKG-STANDART"]),
    ).toBe(239);
  });

  it("three Standart → occ3 349", () => {
    expect(
      composeNaftaPackageNightlySell([
        "PKG-STANDART",
        "PKG-STANDART",
        "PKG-STANDART",
      ]),
    ).toBe(349);
  });

  it("mixed three adults: main + companions (not occ-3 of main)", () => {
    expect(
      composeNaftaPackageNightlySell([
        "PKG-PREMIUM",
        "PKG-STANDART",
        "PKG-STANDART",
      ]),
    ).toBe(193 + 96 + 96);
  });

  it("unresolved → null", () => {
    expect(composeNaftaPackageNightlySell([null, undefined])).toBeNull();
  });

  it("EW Rate Code ignored when not a PKG-* catalog code", () => {
    expect(composeNaftaPackageNightlySell(["BAR-FB", "RO"])).toBeNull();
  });

  it("single Premium → 193", () => {
    expect(composeNaftaPackageNightlySell(["PKG-PREMIUM"])).toBe(193);
  });

  it("halfOcc2 Dermo 321 → 160; Detoks 319 → 160", () => {
    expect(halfOcc2({ code: "PKG-DERMO", occ1: 180, occ2: 321 })).toBe(160);
    expect(halfOcc2({ code: "PKG-DETOKS", occ1: 178, occ2: 319 })).toBe(160);
  });

  it("breakdown lists main + companion lines", () => {
    const b = composeNaftaPackageNightlySellBreakdown([
      "PKG-PREMIUM",
      "PKG-STANDART",
    ]);
    expect(b?.total).toBe(289);
    expect(b?.lines).toHaveLength(2);
    expect(b?.lines[0]).toMatchObject({ role: "main", code: "PKG-PREMIUM", amount: 193 });
    expect(b?.lines[1]).toMatchObject({
      role: "companion",
      code: "PKG-STANDART",
      amount: 96,
    });
  });
});
