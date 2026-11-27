import {
  atStaySeatCap,
  canAddStaySeats,
  exceedsStaySeatMax,
  staySeatHeadcount,
} from "../src/domain/sanatorium/stay-seat-usage";

describe("staySeatHeadcount (package + extras share stay days)", () => {
  it("sums blue fact, package draft, unpaid and paid extras", () => {
    expect(
      staySeatHeadcount({
        packageFact: 7,
        packageDraft: 0,
        unpaidExtra: 5,
        paidExtra: 0,
      }),
    ).toBe(12);
  });

  it("treats missing parts as 0 and floors", () => {
    expect(staySeatHeadcount({ packageFact: 3.9, unpaidExtra: -1 })).toBe(3);
  });
});

describe("stay seat cap gates", () => {
  it("blocks + when package already fills stayMax (Viorica 7+extras hole)", () => {
    const head = staySeatHeadcount({ packageFact: 7, unpaidExtra: 0 });
    expect(atStaySeatCap(head, 7)).toBe(true);
    expect(canAddStaySeats(head, 1, 7)).toBe(false);
  });

  it("allows extras only while total stays under stayMax", () => {
    const head = staySeatHeadcount({ packageFact: 5, unpaidExtra: 1 });
    expect(canAddStaySeats(head, 1, 7)).toBe(true);
    expect(canAddStaySeats(head, 2, 7)).toBe(false);
  });

  it("exceedsStaySeatMax is strict >", () => {
    expect(exceedsStaySeatMax(7, 7)).toBe(false);
    expect(exceedsStaySeatMax(8, 7)).toBe(true);
  });
});
