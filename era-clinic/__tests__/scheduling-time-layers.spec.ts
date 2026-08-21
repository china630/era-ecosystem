import {
  allocationOccupiesCandidate,
  effectivePatientRestMinutes,
} from "@/domain/procedure/resource-occupancy";

function at(h: number, m = 0) {
  return new Date(2026, 7, 21, h, m, 0, 0);
}

describe("allocationOccupiesCandidate (resource gap tail)", () => {
  it("gel gap 0: back-to-back 5-min slots do not collide", () => {
    expect(
      allocationOccupiesCandidate(at(9, 0), at(9, 5), 0, at(9, 5), at(9, 10)),
    ).toBe(false);
  });

  it("gel gap 0: same start is a collision", () => {
    expect(
      allocationOccupiesCandidate(at(9, 0), at(9, 5), 0, at(9, 0), at(9, 5)),
    ).toBe(true);
  });

  it("electro gap 5: start at previous endsAt is blocked", () => {
    expect(
      allocationOccupiesCandidate(at(9, 0), at(9, 10), 5, at(9, 10), at(9, 20)),
    ).toBe(true);
  });

  it("electro gap 5: start at endsAt+5 is free", () => {
    expect(
      allocationOccupiesCandidate(at(9, 0), at(9, 10), 5, at(9, 15), at(9, 25)),
    ).toBe(false);
  });

  it("mixed: oil gap 5 then gel cannot start at oil endsAt", () => {
    expect(
      allocationOccupiesCandidate(at(9, 0), at(9, 10), 5, at(9, 10), at(9, 15)),
    ).toBe(true);
  });

  it("mixed: gel gap 0 after oil endsAt+5 is free", () => {
    expect(
      allocationOccupiesCandidate(at(9, 0), at(9, 10), 5, at(9, 15), at(9, 20)),
    ).toBe(false);
  });
});

describe("effectivePatientRestMinutes", () => {
  it("uses type patient rest when template unset", () => {
    expect(effectivePatientRestMinutes(null, 15)).toBe(15);
    expect(effectivePatientRestMinutes(undefined, 5)).toBe(5);
  });

  it("template can only raise rest, not lower", () => {
    expect(effectivePatientRestMinutes(30, 15)).toBe(30);
    expect(effectivePatientRestMinutes(5, 15)).toBe(15);
  });
});
