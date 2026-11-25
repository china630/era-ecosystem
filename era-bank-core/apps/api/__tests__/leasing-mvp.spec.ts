import { buildLeaseOriginationShape } from "../src/modules/leasing/leasing.shape";

describe("leasing MVP (P1-1)", () => {
  it("builds asset + contract financing shape from catalog and advance", () => {
    const shape = buildLeaseOriginationShape({
      catalogValueMinor: 10_000_000n,
      advancePct: 20,
      residualValueMinor: 500_000n,
      termMonths: 36,
    });
    expect(shape.advancePaymentMinor).toBe(2_000_000n);
    expect(shape.financedPrincipalMinor).toBe(8_000_000n);
    expect(shape.residualValueMinor).toBe(500_000n);
    expect(shape.termMonths).toBe(36);
    expect(shape.advancePct).toBe(20);
    expect(shape.catalogValueMinor).toBe(10_000_000n);
  });

  it("rejects invalid advance percent", () => {
    expect(() =>
      buildLeaseOriginationShape({
        catalogValueMinor: 1_000_000n,
        advancePct: 150,
        residualValueMinor: 0n,
        termMonths: 12,
      }),
    ).toThrow("advancePct");
  });
});