jest.mock("@era/satellite-kit/ui", () => ({
  showApiError: jest.fn(),
  showSuccess: jest.fn(),
}));

import { showApiError, showSuccess } from "@era/satellite-kit/ui";
import {
  buildPackageAssignMissToastLines,
  buildPackageAssignPlacedLines,
  isPackageAssignNoonHold,
  toastPackageAssignOutcome,
} from "@/lib/package-assign-toasts";

const t = (key: string, values?: { count?: number; name?: string; reason?: string }) => {
  if (key === "packageAssignPlaced") return `${values?.count} x ${values?.name}`;
  if (key === "packageAssignNotPlacedLine") {
    return `${values?.count} x ${values?.name} — ${values?.reason}`;
  }
  if (key === "packageAssignToastMore") return `more:${values?.count}`;
  if (key === "packageAssignMissNoCabin") return "no cabin";
  if (key === "packageAssignMissDayFull") return "day full";
  if (key === "packageAssignMissNoSlot") return "no slot";
  if (key === "packageAssignMissBusy") return "busy";
  return `${key}:${values?.count ?? 0}`;
};

describe("toastPackageAssignOutcome", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("emits at most two toasts with SKU lines (placed list + miss list)", () => {
    toastPackageAssignOutcome(
      [
        { procedureCode: "A", procedureName: "Alpha", qty: 10 },
        { procedureCode: "B", procedureName: "Beta", qty: 5 },
      ],
      [
        { procedureCode: "A", procedureName: "Alpha", reason: "no_cabin" },
        { procedureCode: "A", procedureName: "Alpha", reason: "no_cabin" },
        { procedureCode: "B", procedureName: "Beta", reason: "day_full" },
        { procedureCode: "B", procedureName: "Beta", reason: "day_full" },
        { procedureCode: "B", procedureName: "Beta", reason: "day_full" },
      ],
      t,
    );
    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith("8 x Alpha\n2 x Beta");
    expect(showApiError).toHaveBeenCalledTimes(1);
    expect(showApiError).toHaveBeenCalledWith({
      error: "2 x Alpha — no cabin\n3 x Beta — day full",
    });
  });

  it("skips green toast when nothing placed", () => {
    toastPackageAssignOutcome(
      [{ procedureCode: "A", procedureName: "Alpha", qty: 2 }],
      [
        { procedureCode: "A", procedureName: "Alpha", reason: "no_slot" },
        { procedureCode: "A", procedureName: "Alpha", reason: "no_slot" },
      ],
      t,
    );
    expect(showSuccess).not.toHaveBeenCalled();
    expect(showApiError).toHaveBeenCalledTimes(1);
    expect(showApiError).toHaveBeenCalledWith({
      error: "2 x Alpha — no slot",
    });
  });

  it("skips red toast when everything placed", () => {
    toastPackageAssignOutcome(
      [{ procedureCode: "A", procedureName: "Alpha", qty: 3 }],
      [],
      t,
    );
    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledWith("3 x Alpha");
    expect(showApiError).not.toHaveBeenCalled();
  });

  it("collapses same SKU+reason and keeps hitAttemptCap reason distinct", () => {
    const lines = buildPackageAssignMissToastLines(
      [
        { procedureCode: "A", procedureName: "Alpha", reason: "no_slot" },
        { procedureCode: "A", procedureName: "Alpha", reason: "no_slot" },
        { procedureCode: "A", procedureName: "Alpha", reason: "no_slot", hitAttemptCap: true },
      ],
      t,
    );
    expect(lines).toEqual(["2 x Alpha — no slot", "1 x Alpha — busy"]);
  });

  it("builds placed lines as requested minus misses per code", () => {
    const lines = buildPackageAssignPlacedLines(
      [{ procedureCode: "A", procedureName: "Alpha", qty: 5 }],
      [
        { procedureCode: "A", procedureName: "Alpha", reason: "no_cabin" },
        { procedureCode: "A", procedureName: "Alpha", reason: "no_cabin" },
      ],
      t,
    );
    expect(lines).toEqual(["3 x Alpha"]);
  });

  it("truncates long miss lists with toast-more footer", () => {
    const misses = Array.from({ length: 10 }, (_, i) => ({
      procedureCode: `C${i}`,
      procedureName: `Name${i}`,
      reason: "no_cabin" as const,
    }));
    toastPackageAssignOutcome([], misses, t);
    expect(showSuccess).not.toHaveBeenCalled();
    expect(showApiError).toHaveBeenCalledTimes(1);
    const body = (showApiError as jest.Mock).mock.calls[0][0].error as string;
    const rows = body.split("\n");
    expect(rows).toHaveLength(9);
    expect(rows[8]).toBe("more:2");
  });
});

describe("isPackageAssignNoonHold", () => {
  it("treats stay-horizon no_slot/no_day as noon hold", () => {
    expect(isPackageAssignNoonHold({ reason: "no_slot" })).toBe(true);
    expect(isPackageAssignNoonHold({ reason: "no_day" })).toBe(true);
  });

  it("never treats budget/attempt-cap stops as noon hold", () => {
    expect(isPackageAssignNoonHold({ reason: "no_slot", hitAttemptCap: true })).toBe(false);
    expect(isPackageAssignNoonHold({ reason: "no_day", hitAttemptCap: true })).toBe(false);
  });

  it("ignores other miss reasons", () => {
    expect(isPackageAssignNoonHold({ reason: "cabin_busy" })).toBe(false);
    expect(isPackageAssignNoonHold({ reason: "day_full" })).toBe(false);
  });
});
