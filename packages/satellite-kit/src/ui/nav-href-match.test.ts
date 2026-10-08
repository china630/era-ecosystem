import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bestMatchingNavHref, isBestNavHref } from "./nav-href-match";

const noQuery = { get: () => null as string | null };

describe("bestMatchingNavHref", () => {
  const hrefs = ["/executive", "/executive/forecast", "/executive/unit-economics", "/hk", "/hk/maids"];

  it("keeps the parent off when a longer sibling matches", () => {
    const best = bestMatchingNavHref("/executive/unit-economics", noQuery, hrefs);
    assert.equal(best, "/executive/unit-economics");
    assert.equal(isBestNavHref("/executive", best), false);
    assert.equal(isBestNavHref("/hk", bestMatchingNavHref("/hk/maids", noQuery, hrefs)), false);
    assert.equal(isBestNavHref("/hk/maids", bestMatchingNavHref("/hk/maids", noQuery, hrefs)), true);
  });

  it("lights the exact parent only on that page", () => {
    assert.equal(bestMatchingNavHref("/hk", noQuery, hrefs), "/hk");
    assert.equal(bestMatchingNavHref("/executive", noQuery, hrefs), "/executive");
  });

  it("prefers a query pin over the bare path", () => {
    const search = { get: (key: string) => (key === "view" ? "gl" : null) };
    const best = bestMatchingNavHref("/settings/integration", search, [
      "/settings/integration",
      "/settings/integration?view=gl",
      "/settings/integration?view=journal",
    ]);
    assert.equal(best, "/settings/integration?view=gl");
  });
});
