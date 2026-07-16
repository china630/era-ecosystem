import { isWithinCheckInWindow } from "@/domain/procedure/procedure-check-in-window";

describe("procedure check-in time window", () => {
  const scheduled = new Date("2026-07-14T10:00:00.000Z");

  it("allows within −5 / +15 grace", () => {
    expect(
      isWithinCheckInWindow(scheduled, new Date("2026-07-14T09:56:00.000Z"), 5, 15),
    ).toBe(true);
    expect(
      isWithinCheckInWindow(scheduled, new Date("2026-07-14T10:14:00.000Z"), 5, 15),
    ).toBe(true);
  });

  it("rejects outside grace", () => {
    expect(
      isWithinCheckInWindow(scheduled, new Date("2026-07-14T09:50:00.000Z"), 5, 15),
    ).toBe(false);
    expect(
      isWithinCheckInWindow(scheduled, new Date("2026-07-14T10:20:00.000Z"), 5, 15),
    ).toBe(false);
  });
});
