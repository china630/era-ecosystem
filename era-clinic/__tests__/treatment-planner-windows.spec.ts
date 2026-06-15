import { nextWorkSlot, skipLunch } from "@/lib/treatment-planner.service";

describe("treatment planner work windows", () => {
  it("skips lunch block to 14:00", () => {
    const slot = new Date("2026-06-04T13:30:00");
    const out = skipLunch(slot);
    expect(out.getHours()).toBe(14);
    expect(out.getMinutes()).toBe(0);
  });

  it("rolls to next day 09:00 after 17:00", async () => {
    const slot = new Date("2026-06-04T17:30:00");
    const out = await nextWorkSlot(slot);
    expect(out.getDate()).toBe(5);
    expect(out.getHours()).toBe(9);
  });
});
