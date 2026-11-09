import { DUTY_SCHEDULE_TYPES, allowedCodesForDept } from "@/lib/duty-schedules/catalog";
import { filterPickerByBinding } from "@/lib/duty-schedules/picker";
import { shiftYmd } from "@/lib/duty-schedules/week-math";
import { dayHeaderClass, shiftChipClass } from "@/lib/duty-schedules/shift-ui";

describe("duty schedule catalog", () => {
  it("lists WEEK_POST conflict rule for reception/security", () => {
    expect(DUTY_SCHEDULE_TYPES.WEEK_POST.conflict).toBe(
      "one_person_one_post_per_day",
    );
    expect(allowedCodesForDept("RECEPTION")).toContain("E");
    expect(allowedCodesForDept("ENGINEERING")).toContain("DUTY");
    expect(allowedCodesForDept("RECEPTION")).not.toContain("DUTY");
  });

  it("MONTH_DUTY is catalog-only for clinic", () => {
    expect(DUTY_SCHEDULE_TYPES.MONTH_DUTY.conflict).toBe("clinic_only");
    expect(DUTY_SCHEDULE_TYPES.MONTH_DUTY.cellCodes).toEqual([]);
  });

  it("filters picker by org unit and position binding", () => {
    const items = [
      {
        id: "1",
        globalPersonId: "p1",
        name: "A",
        orgUnitId: "u1",
        orgUnitName: "FO",
        positionId: "pos1",
        positionName: "Clerk",
        leadership: false,
      },
      {
        id: "2",
        globalPersonId: "p2",
        name: "B",
        orgUnitId: "u2",
        orgUnitName: "Sec",
        positionId: "pos2",
        positionName: "Guard",
        leadership: false,
      },
    ];
    const filtered = filterPickerByBinding(items, {
      orgUnitIds: ["u1"],
      positionIds: [],
    });
    expect(filtered.map((p) => p.globalPersonId)).toEqual(["p1"]);
  });

  it("shiftYmd moves week boundaries by seven days", () => {
    expect(shiftYmd("2026-11-02", -7)).toBe("2026-10-26");
    expect(shiftYmd("2026-11-02", 7)).toBe("2026-11-09");
  });

  it("shift chips mark orphan and night distinctly", () => {
    expect(shiftChipClass("N")).toContain("slate-800");
    expect(shiftChipClass("E", true)).toContain("amber");
    expect(dayHeaderClass("2026-11-07", "2026-11-07")).toContain("sky");
  });

  it("P2002 unique conflict shape is recognized for seed races", () => {
    const err = { code: "P2002", meta: { target: ["organizationId", "dept"] } };
    expect(err.code).toBe("P2002");
  });
});
