import {
  filterEntitledSatellites,
  rosterSatelliteKeys,
  shouldAllocateNewSeat,
} from "./workforce-satellite-keys";

describe("filterEntitledSatellites", () => {
  const entitled = ["industry_clinic", "industry_hotel_pms", "industry_fnb_pos"];

  it("empty or missing requested keys means headcount only (no seat)", () => {
    expect(filterEntitledSatellites(entitled)).toEqual([]);
    expect(filterEntitledSatellites(entitled, [])).toEqual([]);
    expect(filterEntitledSatellites(entitled, ["", "  "])).toEqual([]);
  });

  it("intersects requested keys with entitled modules", () => {
    expect(filterEntitledSatellites(entitled, ["industry_clinic"])).toEqual([
      "industry_clinic",
    ]);
    expect(
      filterEntitledSatellites(entitled, ["industry_clinic", "industry_unknown"]),
    ).toEqual(["industry_clinic"]);
  });
});

describe("shouldAllocateNewSeat", () => {
  it("does not allocate a seat for headcount hire", () => {
    expect(shouldAllocateNewSeat([], false)).toBe(false);
    expect(shouldAllocateNewSeat([], true)).toBe(false);
  });

  it("allocates one seat only when satellites are requested and none exists", () => {
    expect(shouldAllocateNewSeat(["industry_clinic"], false)).toBe(true);
    expect(shouldAllocateNewSeat(["industry_clinic"], true)).toBe(false);
  });
});

describe("rosterSatelliteKeys", () => {
  it("ADDITIONAL never passes satellite keys", () => {
    expect(rosterSatelliteKeys("ADDITIONAL", "industry_clinic")).toEqual([]);
    expect(rosterSatelliteKeys("additional", "industry_hotel_pms|industry_clinic")).toEqual(
      [],
    );
  });

  it("PRIMARY keeps listed satellites; empty means headcount", () => {
    expect(rosterSatelliteKeys("PRIMARY", "")).toEqual([]);
    expect(rosterSatelliteKeys("PRIMARY", "industry_clinic|industry_hotel_pms")).toEqual([
      "industry_clinic",
      "industry_hotel_pms",
    ]);
  });
});
