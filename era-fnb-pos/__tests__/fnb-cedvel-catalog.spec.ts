import { FNB_ALLOWED_SHIFT_CODES, FNB_DUTY_TYPE } from "@/lib/duty-schedules/catalog";
import { shiftYmd } from "@/lib/duty-schedules/week-math";
import { shiftChipClass } from "@/lib/duty-schedules/shift-ui";

describe("fnb cedvel catalog", () => {
  it("WEEK_PERSON type and allowed codes", () => {
    expect(FNB_DUTY_TYPE).toBe("WEEK_PERSON");
    expect(FNB_ALLOWED_SHIFT_CODES.has("E")).toBe(true);
    expect(FNB_ALLOWED_SHIFT_CODES.has("IB")).toBe(true);
    expect(FNB_ALLOWED_SHIFT_CODES.has("DUTY")).toBe(false);
  });

  it("shiftYmd and chip styles", () => {
    expect(shiftYmd("2026-11-03", -7)).toBe("2026-10-27");
    expect(shiftChipClass("OFF")).toContain("slate-100");
    expect(shiftChipClass("E", true)).toContain("amber");
  });
});
