import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOrgNoMatchesHost,
  parseEraOrgSubdomain,
} from "./era-org-subdomain";

describe("parseEraOrgSubdomain", () => {
  const pools = ["clinic.era-365.online", "hotel-pms.era-365.online"];

  it("extracts orgNo from ERA subdomain", () => {
    const r = parseEraOrgSubdomain("104221.clinic.era-365.online", pools);
    assert.deepEqual(r, { orgNo: "104221", poolHost: "clinic.era-365.online" });
  });

  it("returns null for bare pool host", () => {
    assert.equal(parseEraOrgSubdomain("clinic.era-365.online", pools), null);
  });

  it("returns null when feature suffixes empty", () => {
    assert.equal(parseEraOrgSubdomain("104221.clinic.era-365.online", []), null);
  });

  it("rejects non-6-digit labels", () => {
    assert.equal(parseEraOrgSubdomain("nafta.clinic.era-365.online", pools), null);
  });
});

describe("assertOrgNoMatchesHost", () => {
  it("allows matching or missing client orgNo", () => {
    assert.equal(assertOrgNoMatchesHost("104221", "104221").ok, true);
    assert.equal(assertOrgNoMatchesHost("104221", undefined).ok, true);
    assert.equal(assertOrgNoMatchesHost(undefined, "104221").ok, true);
  });

  it("rejects mismatch", () => {
    const r = assertOrgNoMatchesHost("104221", "204222");
    assert.equal(r.ok, false);
  });
});
