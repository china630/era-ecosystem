import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestMatchingNavHref,
  isBestNavHref,
  sectionOwnsBestHref,
} from "./nav-href-match";
import type { EraOpsNavSection } from "./era-ops-types";

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

  it("lights only the policy hash that is open", () => {
    const hrefs = [
      "/settings/policies#letterhead",
      "/settings/policies#hk",
      "/settings/policies#laundry",
    ];
    const best = bestMatchingNavHref("/settings/policies", noQuery, hrefs, "laundry");
    assert.equal(best, "/settings/policies#laundry");
    assert.equal(isBestNavHref("/settings/policies#hk", best), false);
    assert.equal(isBestNavHref("/settings/policies#laundry", best), true);
    assert.equal(bestMatchingNavHref("/settings/policies", noQuery, hrefs, ""), null);
  });

  it("opens Schedules for /hk/roster, not Housekeeping via /hk prefix", () => {
    const hk: EraOpsNavSection = {
      id: "hotel_housekeeping",
      title: "HK",
      items: [{ href: "/hk", label: "Floor" }, { href: "/hk/maids", label: "Maids" }],
    };
    const schedules: EraOpsNavSection = {
      id: "hotel_schedules",
      title: "Schedules",
      items: [
        { href: "/schedules", label: "Hub" },
        { href: "/hk/roster", label: "HK roster" },
      ],
    };
    const all = [
      ...hk.items.map((i) => i.href!),
      ...schedules.items.map((i) => i.href!),
    ];
    const best = bestMatchingNavHref("/hk/roster", noQuery, all);
    assert.equal(best, "/hk/roster");
    assert.equal(sectionOwnsBestHref(hk, best), false);
    assert.equal(sectionOwnsBestHref(schedules, best), true);
  });
});
