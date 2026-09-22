import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFolkloreS2sToken } from "./folklore-s2s-token";

describe("isFolkloreS2sToken", () => {
  it("treats empty and compose defaults as folklore", () => {
    assert.equal(isFolkloreS2sToken(""), true);
    assert.equal(isFolkloreS2sToken(undefined), true);
    assert.equal(isFolkloreS2sToken("dev-satellite-event-token"), true);
    assert.equal(isFolkloreS2sToken("dev-control-plane-token"), true);
    assert.equal(isFolkloreS2sToken("change-me-satellite-event-token_!@"), true);
  });

  it("accepts a real secret", () => {
    assert.equal(isFolkloreS2sToken("prod-event-secret-min-16"), false);
  });
});
