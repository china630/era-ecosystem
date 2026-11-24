import {
  buildProcedureLoadMatrix,
  countToLevel,
  estimateDayCapacity,
  pctToLevel,
  procedureLoadLevelColor,
} from "@/domain/planning/procedure-load-matrix";

describe("procedure-load-matrix", () => {
  it("maps peak count to top level", () => {
    expect(countToLevel(0, 10)).toBe(0);
    expect(countToLevel(10, 10)).toBe(9);
    expect(countToLevel(5, 10)).toBeGreaterThanOrEqual(4);
  });

  it("maps fill percent to level", () => {
    expect(pctToLevel(0)).toBe(0);
    expect(pctToLevel(0.5)).toBe(5);
    expect(pctToLevel(1)).toBe(9);
    expect(pctToLevel(1.2)).toBe(9);
  });

  it("estimates day capacity from work window and resource seats", () => {
    // 9–17 minus 13–14 lunch = 7h = 420 min; 20 min → 21 slots × capacity 2 = 42
    expect(
      estimateDayCapacity({
        dayStartHour: 9,
        dayEndHour: 17,
        lunchStartHour: 13,
        lunchEndHour: 14,
        durationMin: 20,
        resourceCapacitySum: 2,
      }),
    ).toBe(42);
  });

  it("builds top-N rows with capacity-based levels when capacity given", () => {
    const counts = new Map<string, Map<string, number>>([
      ["A", new Map([["2026-11-24", 8], ["2026-11-25", 2]])],
      ["B", new Map([["2026-11-24", 1]])],
      ["C", new Map([["2026-11-24", 3]])],
    ]);
    const names = new Map([
      ["A", "Alpha"],
      ["B", "Beta"],
      ["C", "Gamma"],
    ]);
    const matrix = buildProcedureLoadMatrix({
      fromYmd: "2026-11-24",
      toYmd: "2026-11-25",
      counts,
      names,
      dayCapacityByCode: new Map([["A", 10], ["B", 10], ["C", 10]]),
      topN: 2,
      nowYmd: "2026-11-24",
    });
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.capacityBased).toBe(true);
    expect(matrix.rows[0]!.procedureCode).toBe("A");
    expect(matrix.rows[0]!.cells[0]!.capacity).toBe(10);
    expect(matrix.rows[0]!.cells[0]!.pct).toBe(0.8);
    expect(matrix.rows[0]!.cells[0]!.level).toBe(pctToLevel(0.8));
    expect(procedureLoadLevelColor(0)).toMatch(/^#/);
  });

  it("falls back to peak-normalized levels when capacity is unknown", () => {
    const counts = new Map<string, Map<string, number>>([
      ["A", new Map([["2026-11-24", 8]])],
      ["B", new Map([["2026-11-24", 2]])],
    ]);
    const matrix = buildProcedureLoadMatrix({
      fromYmd: "2026-11-24",
      toYmd: "2026-11-24",
      counts,
      names: new Map([["A", "Alpha"], ["B", "Beta"]]),
      topN: 2,
      nowYmd: "2026-11-24",
    });
    expect(matrix.capacityBased).toBe(false);
    expect(matrix.rows[0]!.cells[0]!.capacity).toBeNull();
    expect(matrix.rows[0]!.cells[0]!.level).toBe(countToLevel(8, 8));
  });
});
