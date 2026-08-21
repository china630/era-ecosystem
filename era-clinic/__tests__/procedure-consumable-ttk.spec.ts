/** Pure resolve mirror for CLI-47 (avoids jose/satellite-kit Jest ESM). */
function resolveLines(
  rows: Array<{ sku: string; qtyPerSession: number; wasteFactor: number; financeProductId?: string | null }>,
) {
  return rows.map((r) => {
    const qty = Number(r.qtyPerSession) * (1 + Number(r.wasteFactor));
    return {
      sku: r.sku,
      qty: Math.round(qty * 10000) / 10000,
      description: r.sku,
      ...(r.financeProductId ? { financeProductId: r.financeProductId } : {}),
    };
  });
}

describe("procedure consumable TTK resolve", () => {
  it("returns empty array when BOM is empty (no PROC- dummy)", () => {
    expect(resolveLines([])).toEqual([]);
  });

  it("resolves qty with wasteFactor", () => {
    expect(
      resolveLines([
        { sku: "ELEC-01", qtyPerSession: 2, wasteFactor: 0.1, financeProductId: "fp-1" },
      ]),
    ).toEqual([
      {
        sku: "ELEC-01",
        qty: 2.2,
        description: "ELEC-01",
        financeProductId: "fp-1",
      },
    ]);
  });
});
