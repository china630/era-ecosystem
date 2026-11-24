import {
  buildProcedureLoadMatrix,
  countToLevel,
  procedureLoadLevelColor,
} from "@/domain/planning/procedure-load-matrix";

describe("procedure-load-matrix", () => {
  it("maps peak count to top level", () => {
    expect(countToLevel(0, 10)).toBe(0);
    expect(countToLevel(10, 10)).toBe(9);
    expect(countToLevel(5, 10)).toBeGreaterThanOrEqual(4);
  });

  it("builds top-N rows with day cells", () => {
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
      topN: 2,
      nowYmd: "2026-11-24",
    });
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]!.procedureCode).toBe("A");
    expect(matrix.rows[0]!.cells).toHaveLength(2);
    expect(procedureLoadLevelColor(0)).toMatch(/^#/);
  });
});
