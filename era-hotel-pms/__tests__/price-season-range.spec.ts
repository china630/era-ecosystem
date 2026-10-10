import { seasonRangesOverlap } from "@/lib/pricing/price-season";

describe("price season ranges", () => {
  it("treats a shared day as an overlap", () => {
    expect(
      seasonRangesOverlap(
        { startsOn: "2026-05-01", endsOn: "2026-10-31" },
        { startsOn: "2026-10-31", endsOn: "2027-04-30" },
      ),
    ).toBe(true);
  });

  it("allows seasons that only touch at the boundary gap", () => {
    expect(
      seasonRangesOverlap(
        { startsOn: "2026-05-01", endsOn: "2026-10-31" },
        { startsOn: "2026-11-01", endsOn: "2027-04-30" },
      ),
    ).toBe(false);
  });
});
