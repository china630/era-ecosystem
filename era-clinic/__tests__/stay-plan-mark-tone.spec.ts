import {
  pickStayPlanMarkForDay,
  stayPlanMarkTone,
} from "@/components/sanatorium/stay-plan-mark-tone";

describe("stayPlanMarkTone", () => {
  it("orders done > paid > unpaid extra > package", () => {
    expect(stayPlanMarkTone({ done: true, paid: true, inPackage: false })).toBe("done");
    expect(stayPlanMarkTone({ done: false, paid: true, inPackage: false })).toBe("paid");
    expect(stayPlanMarkTone({ done: false, paid: false, inPackage: false })).toBe(
      "unpaidExtra",
    );
    expect(stayPlanMarkTone({ done: false, paid: false, inPackage: true })).toBe("package");
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
});
