import {
  pickStayPlanMarkForDay,
  stayPlanDotClass,
  stayPlanMarkTone,
  stayPlanMoneyTone,
  stayPlanMarksForDay,
} from "@/components/sanatorium/stay-plan-mark-tone";

describe("stayPlanMoneyTone", () => {
  it("keeps money lane even when done", () => {
    expect(stayPlanMoneyTone({ paid: true, inPackage: false })).toBe("paid");
    expect(stayPlanMoneyTone({ paid: false, inPackage: false })).toBe("unpaidExtra");
    expect(stayPlanMoneyTone({ paid: false, inPackage: true })).toBe("package");
  });
});

describe("stayPlanMarkTone", () => {
  it("legacy: done flag still reported for callers that ask tone name", () => {
    expect(stayPlanMarkTone({ done: true, paid: true, inPackage: false })).toBe("done");
    expect(stayPlanMarkTone({ done: false, paid: true, inPackage: false })).toBe("paid");
    expect(stayPlanMarkTone({ done: false, paid: false, inPackage: false })).toBe(
      "unpaidExtra",
    );
    expect(stayPlanMarkTone({ done: false, paid: false, inPackage: true })).toBe("package");
  });
});

describe("stayPlanDotClass", () => {
  it("keeps paid fill when done (ring overlay, not green replace)", () => {
    const paidDone = stayPlanDotClass({ done: true, paid: true, inPackage: false });
    const paidOpen = stayPlanDotClass({ done: false, paid: true, inPackage: false });
    expect(paidDone).toContain("bg-[#D4A017]");
    expect(paidDone).toContain("outline-[#196F3D]");
    expect(paidOpen).toContain("bg-[#D4A017]");
    expect(paidOpen).not.toContain("outline-[#196F3D]");
  });
});

describe("pickStayPlanMarkForDay", () => {
  it("picks unpaid extra over package on the same day", () => {
    const picked = pickStayPlanMarkForDay(
      [
        { ymd: "2026-11-24", done: false, paid: false, inPackage: true },
        { ymd: "2026-11-24", done: false, paid: false, inPackage: false },
      ],
      "2026-11-24",
    );
    expect(picked?.inPackage).toBe(false);
  });

  it("picks paid over unpaid extra on the same day", () => {
    const picked = pickStayPlanMarkForDay(
      [
        { ymd: "2026-11-24", done: false, paid: false, inPackage: false },
        { ymd: "2026-11-24", done: false, paid: true, inPackage: false },
      ],
      "2026-11-24",
    );
    expect(picked?.paid).toBe(true);
  });

  it("lists all same-day marks for tooltip honesty", () => {
    const day = stayPlanMarksForDay(
      [
        { ymd: "2026-11-24", kind: "pkg" },
        { ymd: "2026-11-24", kind: "extra" },
        { ymd: "2026-11-25", kind: "other" },
      ],
      "2026-11-24",
    );
    expect(day).toHaveLength(2);
  });
});
