import {
  buildAssignSaveOutcome,
  packageAssignMissAdviceKey,
} from "@/lib/package-assign-outcome";

describe("package-assign-outcome", () => {
  it("counts placed vs requested and groups misses", () => {
    const outcome = buildAssignSaveOutcome(
      [
        { procedureCode: "A", procedureName: "Alpha", qty: 3 },
        { procedureCode: "B", procedureName: "Beta", qty: 1 },
      ],
      [
        { procedureCode: "A", procedureName: "Alpha", ymd: "2026-11-25", reason: "no_cabin" },
        { procedureCode: "A", procedureName: "Alpha", ymd: "2026-11-25", reason: "no_cabin" },
        { procedureCode: "B", procedureName: "Beta", ymd: "2026-11-26", reason: "day_full" },
      ],
    );
    expect(outcome.requestedQty).toBe(4);
    expect(outcome.missQty).toBe(3);
    expect(outcome.placedQty).toBe(1);
    expect(outcome.misses).toHaveLength(2);
    const a = outcome.misses.find((row) => row.procedureCode === "A");
    expect(a?.count).toBe(2);
  });

  it("maps reasons to advice keys", () => {
    expect(packageAssignMissAdviceKey("no_cabin")).toBe("packageAssignAdviceNoCabin");
    expect(packageAssignMissAdviceKey("series_rhythm")).toBe("packageAssignAdviceSeriesRhythm");
    expect(packageAssignMissAdviceKey("x", { hitAttemptCap: true })).toBe("packageAssignAdviceBusy");
  });
});
