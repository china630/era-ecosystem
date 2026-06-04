import {
  PROCEDURES_PER_GUEST_WEEK,
  RISK_GUEST_WEEK_MAX,
  RISK_GUEST_WEEK_MIN,
} from "./capacity.service";

describe("capacity risk bands", () => {
  it("maps guest equivalent to risk levels", () => {
    const warning = RISK_GUEST_WEEK_MIN * PROCEDURES_PER_GUEST_WEEK;
    const critical = RISK_GUEST_WEEK_MAX * PROCEDURES_PER_GUEST_WEEK;
    expect(warning).toBe(960);
    expect(critical).toBe(1000);
  });
});
