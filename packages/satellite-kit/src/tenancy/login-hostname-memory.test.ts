import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearLoginHostnameCacheForTests,
  resolveLoginHost,
  upsertLoginHostname,
} from "./login-hostname-memory";

describe("login hostname memory", () => {
  it("resolves ACTIVE satellite_login host to organizationId", () => {
    clearLoginHostnameCacheForTests();
    upsertLoginHostname("pms.client.az", {
      organizationId: "11111111-1111-4111-8111-111111111111",
      satelliteKey: "industry_hotel_pms",
      kind: "satellite_login",
      status: "ACTIVE",
    });
    const hit = resolveLoginHost("pms.client.az", "industry_hotel_pms");
    assert.deepEqual(hit, {
      organizationId: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(resolveLoginHost("pms.client.az", "industry_clinic"), null);
  });
});
