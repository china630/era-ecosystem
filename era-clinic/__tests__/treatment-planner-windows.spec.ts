import { nextWorkSlot, skipLunch } from "@/lib/treatment-planner.service";
import { bakuHourMinute, parseBakuDateTime } from "@/lib/baku-day";

describe("treatment planner work windows", () => {
  it("skips lunch block to 14:00 Baku", () => {
    const slot = parseBakuDateTime("2026-06-04", "13:30");
    const out = skipLunch(slot);
    expect(bakuHourMinute(out)).toEqual({ hour: 14, minute: 0 });
    expect(out.toISOString()).toBe(parseBakuDateTime("2026-06-04", "14:00").toISOString());
  });

  it("rolls to next day 09:00 Baku after 17:00", async () => {
    const slot = parseBakuDateTime("2026-06-04", "17:30");
    const out = await nextWorkSlot(slot);
    expect(bakuHourMinute(out)).toEqual({ hour: 9, minute: 0 });
    expect(out.toISOString()).toBe(parseBakuDateTime("2026-06-05", "09:00").toISOString());
  });
});
