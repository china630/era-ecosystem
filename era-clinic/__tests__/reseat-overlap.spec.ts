import { guestSlotOverlaps } from "@/domain/planning/reseat-schedule";

describe("guestSlotOverlaps", () => {
  it("flags two procedures that start together", () => {
    expect(
      guestSlotOverlaps([
        { startMs: 1000, endMs: 2000 },
        { startMs: 1000, endMs: 1800 },
      ]),
    ).toBe(true);
  });

  it("allows back-to-back sessions", () => {
    expect(
      guestSlotOverlaps([
        { startMs: 1000, endMs: 2000 },
        { startMs: 2000, endMs: 3000 },
      ]),
    ).toBe(false);
  });
});
