import { NAFTA_BONUS_SCHEDULE, netFactor } from "@/domain/reports/bonus-schedule";

describe("nafta bonus schedule", () => {
  it("keeps 62 percent after 18 and 20", () => {
    expect(netFactor(NAFTA_BONUS_SCHEDULE)).toBeCloseTo(0.62);
  });

  it("splits ambulatory physio into referrer and performer", () => {
    expect(NAFTA_BONUS_SCHEDULE.walkIn.physio).toEqual({ refer: 25, perform: 10 });
    expect(NAFTA_BONUS_SCHEDULE.inHouse.massage).toEqual({ refer: 5, perform: 10 });
  });
});
