import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  fiscalize,
  resolveFiscalProviderName,
  saleForSatellite,
  resolveDefaultDevices,
  listDevices,
  resetDeviceDirectoryForTests,
  resetIdempotencyStoreForTests,
  getDeviceDirectory,
  FISCAL_ERROR,
  FiscalError,
} from "../index";

describe("@era/fiscal", () => {
  beforeEach(() => {
    resetDeviceDirectoryForTests();
    resetIdempotencyStoreForTests();
  });

  it("defaults to mock provider via env", () => {
    assert.equal(resolveFiscalProviderName({ ERA_FISCAL_PROVIDER: "mock" }), "mock");
    assert.equal(resolveFiscalProviderName({ KKM_DRIVER: "nbc" }), "nbc");
  });

  it("fiscalize returns receiptId and driver (env fallback)", async () => {
    const r = await fiscalize(
      { documentRef: "test-1", amount: 10, paymentMethod: "CASH" },
      { ERA_FISCAL_PROVIDER: "mock" },
    );
    assert.ok(r.receiptId.startsWith("KKM-"));
    assert.equal(r.driver, "mock");
  });

  it("empty catalog → recorded_no_device", async () => {
    const outcome = await saleForSatellite({
      organizationId: "org-a",
      documentRef: "doc-1",
      lines: [{ name: "Tea", qty: 1, unitPrice: 2 }],
      tenders: [{ method: "CASH", amount: 2 }],
    });
    assert.ok("skipped" in outcome && outcome.skipped);
    if ("skipped" in outcome && outcome.skipped) {
      assert.equal(outcome.reason, "recorded_no_device");
    }
  });

  it("fiscalize with organizationId and empty catalog does not env-mock", async () => {
    const r = await fiscalize({
      documentRef: "test-org",
      amount: 10,
      paymentMethod: "CASH",
      organizationId: "org-kafe",
    });
    assert.equal(r.skipped, true);
    assert.equal(r.skipReason, "recorded_no_device");
    assert.equal(r.driver, "none");
  });

  it("LIVE empty catalog throws LIVE_DEVICE_REQUIRED", async () => {
    const prev = process.env.ERA_FISCAL_LIVE;
    process.env.ERA_FISCAL_LIVE = "true";
    try {
      await assert.rejects(
        () =>
          saleForSatellite({
            organizationId: "org-live",
            documentRef: "doc-live",
            lines: [{ name: "Tea", qty: 1, unitPrice: 2 }],
            tenders: [{ method: "CASH", amount: 2 }],
          }),
        (e: unknown) =>
          e instanceof FiscalError && e.code === FISCAL_ERROR.LIVE_DEVICE_REQUIRED,
      );
    } finally {
      if (prev === undefined) delete process.env.ERA_FISCAL_LIVE;
      else process.env.ERA_FISCAL_LIVE = prev;
    }
  });

  it("single device auto-selects and is idempotent", async () => {
    getDeviceDirectory().upsert({
      id: "kkm-1",
      organizationId: "org-a",
      kind: "FISCAL_KKM",
      providerId: "mock",
      label: "Till 1",
      status: "active",
    });
    const a = await saleForSatellite({
      organizationId: "org-a",
      documentRef: "doc-2",
      lines: [{ name: "Tea", qty: 1, unitPrice: 2 }],
      tenders: [{ method: "CASH", amount: 2 }],
    });
    const b = await saleForSatellite({
      organizationId: "org-a",
      documentRef: "doc-2",
      lines: [{ name: "Tea", qty: 1, unitPrice: 2 }],
      tenders: [{ method: "CASH", amount: 2 }],
    });
    assert.ok(!("skipped" in a && a.skipped));
    if (!("skipped" in a)) {
      assert.equal(a.fiscalDeviceId, "kkm-1");
      assert.ok(a.receiptId);
    }
    assert.deepEqual(a, b);
  });

  it("multiple devices without default → DEVICE_SELECTION_REQUIRED", () => {
    const dir = getDeviceDirectory();
    dir.upsert({
      id: "kkm-1",
      organizationId: "org-b",
      kind: "FISCAL_KKM",
      providerId: "mock",
      label: "A",
      status: "active",
    });
    dir.upsert({
      id: "kkm-2",
      organizationId: "org-b",
      kind: "FISCAL_KKM",
      providerId: "mock",
      label: "B",
      status: "active",
    });
    assert.throws(
      () =>
        resolveDefaultDevices({
          organizationId: "org-b",
          requireFiscal: true,
        }),
      (e: unknown) =>
        e instanceof FiscalError &&
        e.code === FISCAL_ERROR.DEVICE_SELECTION_REQUIRED,
    );
  });

  it("org default wins among multiple", () => {
    const dir = getDeviceDirectory();
    dir.upsert({
      id: "kkm-1",
      organizationId: "org-c",
      kind: "FISCAL_KKM",
      providerId: "mock",
      label: "A",
      status: "active",
    });
    dir.upsert({
      id: "kkm-2",
      organizationId: "org-c",
      kind: "FISCAL_KKM",
      providerId: "mock",
      label: "B",
      status: "active",
      isOrgDefault: true,
    });
    const r = resolveDefaultDevices({
      organizationId: "org-c",
      requireFiscal: true,
    });
    assert.equal(r.fiscalDeviceId, "kkm-2");
  });

  it("listDevices filters by outlet", () => {
    const dir = getDeviceDirectory();
    dir.upsert({
      id: "kkm-bar",
      organizationId: "org-d",
      kind: "FISCAL_KKM",
      providerId: "mock",
      label: "Bar",
      outletCode: "BAR",
      status: "active",
    });
    dir.upsert({
      id: "kkm-lobby",
      organizationId: "org-d",
      kind: "FISCAL_KKM",
      providerId: "mock",
      label: "Lobby",
      outletCode: "LOBBY",
      status: "active",
    });
    const listed = listDevices({
      organizationId: "org-d",
      outletCode: "BAR",
      kind: "FISCAL_KKM",
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.id, "kkm-bar");
  });
});
