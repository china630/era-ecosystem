/**
 * Unit-ish isolation check: two orgs do not share device directory entries.
 * Run: node --test (after era-fiscal build) or import in orch jest later.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  resetDeviceDirectoryForTests,
  getDeviceDirectory,
  listDevices,
} from "@era/fiscal";
import { hydrateFiscalDevicesFromSync } from "../integration/fiscal-device-hydrate";

describe("fiscal device org isolation", () => {
  beforeEach(() => {
    resetDeviceDirectoryForTests();
  });

  it("hydrates per org without cross-leak", () => {
    hydrateFiscalDevicesFromSync("org-1", [
      {
        id: "11111111-1111-1111-1111-111111111111",
        organizationId: "org-1",
        kind: "FISCAL_KKM",
        providerId: "mock",
        label: "A",
        status: "active",
      },
    ]);
    hydrateFiscalDevicesFromSync("org-2", [
      {
        id: "22222222-2222-2222-2222-222222222222",
        organizationId: "org-2",
        kind: "FISCAL_KKM",
        providerId: "omnitech",
        label: "B",
        status: "active",
      },
    ]);
    assert.equal(listDevices({ organizationId: "org-1" }).length, 1);
    assert.equal(listDevices({ organizationId: "org-2" }).length, 1);
    assert.equal(listDevices({ organizationId: "org-1" })[0]!.label, "A");
    assert.equal(getDeviceDirectory().get("org-1", "22222222-2222-2222-2222-222222222222"), undefined);
  });

  it("hydrates decrypted secrets onto the in-memory row", () => {
    hydrateFiscalDevicesFromSync("org-s", [
      {
        id: "33333333-3333-3333-3333-333333333333",
        organizationId: "org-s",
        kind: "FISCAL_KKM",
        providerId: "nbc",
        label: "NBC",
        status: "active",
        secrets: { apiToken: "tok" },
        endpoint: "http://kkm.local",
      },
    ]);
    const row = getDeviceDirectory().get("org-s", "33333333-3333-3333-3333-333333333333");
    assert.equal(row?.secrets?.apiToken, "tok");
    assert.equal(row?.endpoint, "http://kkm.local");
  });
});
