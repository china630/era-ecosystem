import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enterSatelliteTenant,
  getSatelliteTenantContext,
  resolveSatelliteTenantOrgId,
  runWithSatelliteTenant,
} from "./satellite-tenant-context";

describe("enterSatelliteTenant", () => {
  it("binds ALS for the remainder of the call chain (enterWith)", () => {
    enterSatelliteTenant({ organizationId: "11111111-1111-4111-8111-111111111111" });
    assert.equal(
      getSatelliteTenantContext()?.organizationId,
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(
      resolveSatelliteTenantOrgId(),
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("runWith still nests a scoped store", () => {
    enterSatelliteTenant({ organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    const nested = runWithSatelliteTenant(
      { organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      () => resolveSatelliteTenantOrgId(),
    );
    assert.equal(nested, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });
});
