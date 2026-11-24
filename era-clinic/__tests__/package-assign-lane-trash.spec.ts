import {
  canTrashAssignLane,
  clearExtraDraftForLane,
  cutAllPendingForLane,
  extraCutKey,
} from "@/domain/sanatorium/package-assign-lane-trash";

describe("package-assign-lane-trash", () => {
  it("shows trash for pure unpaid", () => {
    expect(canTrashAssignLane({ hasUnlockedPackage: false, unpaidQty: 12 })).toBe(true);
  });

  it("shows trash for unlocked package", () => {
    expect(canTrashAssignLane({ hasUnlockedPackage: true, unpaidQty: 0 })).toBe(true);
  });

  it("hides trash for paid-only / locked-only (no unpaid)", () => {
    expect(canTrashAssignLane({ hasUnlockedPackage: false, unpaidQty: 0 })).toBe(false);
  });

  it("shows trash for locked package when unpaid remains", () => {
    expect(canTrashAssignLane({ hasUnlockedPackage: false, unpaidQty: 3 })).toBe(true);
  });

  it("extraCutKey is code|regime", () => {
    expect(extraCutKey("HG4", "r1")).toBe("HG4|r1");
  });

  it("clearExtraDraftForLane drops matching code+regime only", () => {
    const draft = [
      { key: "a", procedureCode: "HG4", regimeKey: "r1", qty: 12 },
      { key: "b", procedureCode: "HG4", regimeKey: "r2", qty: 2 },
      { key: "c", procedureCode: "OTHER", regimeKey: "r1", qty: 1 },
    ];
    const next = clearExtraDraftForLane(draft, "HG4", "r1", (row) => row.regimeKey ?? "");
    expect(next.map((r) => r.key)).toEqual(["b", "c"]);
  });

  it("cutAllPendingForLane sets cut to pending count", () => {
    const next = cutAllPendingForLane({ "HG4|r1": 1 }, "HG4", "r1", 12);
    expect(next["HG4|r1"]).toBe(12);
  });

  it("cutAllPendingForLane clears key when pendingCount is 0", () => {
    const next = cutAllPendingForLane({ "HG4|r1": 3, keep: 1 }, "HG4", "r1", 0);
    expect(next["HG4|r1"]).toBeUndefined();
    expect(next.keep).toBe(1);
  });
});
