import {
  stayMonthTitle,
  stayWindowDays,
  stayMonthSpans,
} from "@/domain/sanatorium/stay-day-axis";
import { stripLatinParamEcho } from "@/components/physio/physio-params-label";

describe("package assign modal polish", () => {
  it("stayMonthTitle uses locale month names not M11", () => {
    expect(stayMonthTitle("2026-11-24", "az")).toBe("Noyabr");
    expect(stayMonthTitle("2026-12-01", "az")).toBe("Dekabr");
    expect(stayMonthTitle("2026-11-24", "en")).toBe("November");
    expect(stayMonthTitle("2026-11-24", "ru")).toBe("Ноябрь");
  });

  it("stayWindowDays pads check-in−1 and checkout+1", () => {
    const days = stayWindowDays({
      days: ["2026-11-24", "2026-11-25", "2026-11-26"],
      checkoutYmd: "2026-11-26",
    });
    expect(days[0]).toBe("2026-11-23");
    expect(days[days.length - 1]).toBe("2026-11-27");
  });

  it("stayMonthSpans groups by calendar month", () => {
    const spans = stayMonthSpans(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(spans).toEqual([
      { ymd: "2026-11-29", span: 2 },
      { ymd: "2026-12-01", span: 2 },
    ]);
  });

  it("stripLatinParamEcho drops English catalog echoes", () => {
    expect(stripLatinParamEcho("Qurşağa qədər (To the waist (half bath))")).toBe("Qurşağa qədər");
    expect(stripLatinParamEcho("Bud-çanaq oynağı (Hip joint and gluteal region)")).toBe(
      "Bud-çanaq oynağı",
    );
    expect(
      stripLatinParamEcho("Qurşağa qədər · çiyinlə · Aşağı ətraf (Lower limb)"),
    ).toBe("Qurşağa qədər · çiyinlə · Aşağı ətraf");
  });
});
