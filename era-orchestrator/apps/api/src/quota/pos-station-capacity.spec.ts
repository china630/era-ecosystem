import { describe, it, expect } from "@jest/globals";
import {
  posStationOverageUnits,
  posStationUnitAzn,
} from "./pos-station-capacity";

describe("posStationOverageUnits", () => {
  it("F&B Gate includes 1 pos", () => {
    expect(posStationOverageUnits(1, "industry_fnb_pos")).toBe(0);
    expect(posStationOverageUnits(2, "industry_fnb_pos")).toBe(1);
    expect(posStationOverageUnits(3, "industry_fnb_pos")).toBe(2);
  });

  it("retail register same overage", () => {
    expect(posStationOverageUnits(1, "industry_retail")).toBe(0);
    expect(posStationOverageUnits(2, "industry_retail")).toBe(1);
  });

  it("unit price from CAPACITY_DRIVERS", () => {
    expect(posStationUnitAzn("industry_fnb_pos")).toBe(19);
  });

  it("unknown satellite → no overage", () => {
    expect(posStationOverageUnits(5, "industry_unknown")).toBe(0);
  });
});
