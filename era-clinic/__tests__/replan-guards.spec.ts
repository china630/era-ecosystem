import { isReplanImmovable } from "@/domain/procedure/replan-guards";

describe("replan immovable guards (CLI-49)", () => {
  const now = new Date("2026-08-23T10:00:00");
  const future = new Date("2026-08-23T11:00:00");
  const past = new Date("2026-08-23T09:00:00");

  it("never moves CHECKED_IN / COMPLETED", () => {
    expect(
      isReplanImmovable({
        status: "CHECKED_IN",
        scheduledAt: future,
        now,
        manuallyAdjusted: false,
        respectPins: true,
      }),
    ).toBe(true);
    expect(
      isReplanImmovable({
        status: "COMPLETED",
        scheduledAt: future,
        now,
        manuallyAdjusted: false,
        respectPins: true,
      }),
    ).toBe(true);
  });

  it("skips pins when respectPins", () => {
    expect(
      isReplanImmovable({
        status: "SCHEDULED",
        scheduledAt: future,
        now,
        manuallyAdjusted: true,
        respectPins: true,
      }),
    ).toBe(true);
    expect(
      isReplanImmovable({
        status: "SCHEDULED",
        scheduledAt: future,
        now,
        manuallyAdjusted: true,
        respectPins: false,
      }),
    ).toBe(false);
  });

  it("skips past slots", () => {
    expect(
      isReplanImmovable({
        status: "SCHEDULED",
        scheduledAt: past,
        now,
        manuallyAdjusted: false,
        respectPins: true,
      }),
    ).toBe(true);
  });
});
