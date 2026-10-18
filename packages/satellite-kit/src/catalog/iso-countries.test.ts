import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countryLabel, countryOptions } from "./iso-countries.js";

describe("countryLabel", () => {
  it("uses explicit Azerbaijani names, not the host Intl locale", () => {
    assert.equal(countryLabel("AZ", "az"), "Azərbaycan (AZ)");
    assert.equal(countryLabel("AZ", "en"), "Azerbaijan (AZ)");
    assert.equal(countryLabel("AZ", "ru"), "Азербайджан (AZ)");
  });

  it("keeps az labels when the UI locale has a region tag", () => {
    assert.equal(countryLabel("TR", "az-AZ"), countryLabel("TR", "az"));
    assert.match(countryLabel("TR", "az"), /Türkiyə/);
  });

  it("lists Azerbaijan under the Azerbaijani name in options", () => {
    const az = countryOptions("az").find((row) => row.value === "AZ");
    assert.equal(az?.label, "Azərbaycan (AZ)");
  });
});
