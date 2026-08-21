import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  onSatelliteBoot,
  resetOrganizationBindForTests,
  resolveSatelliteOrganizationId,
  setRuntimeOrganizationId,
  SatelliteOrganizationUnboundError,
} from "./organization-bind-core";

afterEach(() => {
  resetOrganizationBindForTests();
  delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
  delete process.env.ERA_BANK_ORGANIZATION_ID;
  delete process.env.ORGANIZATION_ID;
  delete process.env.NODE_ENV;
});

describe("resolveSatelliteOrganizationId", () => {
  it("prefers runtime over env", () => {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = "env-org";
    setRuntimeOrganizationId("runtime-org");
    const r = resolveSatelliteOrganizationId();
    assert.equal(r.organizationId, "runtime-org");
    assert.equal(r.source, "runtime");
  });

  it("uses env when runtime empty", () => {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = "env-org-uuid";
    const r = resolveSatelliteOrganizationId();
    assert.equal(r.organizationId, "env-org-uuid");
    assert.equal(r.source, "env");
  });

  it("uses ERA_BANK_ORGANIZATION_ID when satellite env empty", () => {
    process.env.ERA_BANK_ORGANIZATION_ID = "bank-org-uuid";
    const r = resolveSatelliteOrganizationId();
    assert.equal(r.organizationId, "bank-org-uuid");
    assert.equal(r.source, "env");
  });

  it("falls back to demo-org outside production", () => {
    process.env.NODE_ENV = "development";
    const r = resolveSatelliteOrganizationId();
    assert.equal(r.organizationId, "demo-org");
    assert.equal(r.source, "fallback");
  });

  it("throws in production when unbound", () => {
    process.env.NODE_ENV = "production";
    assert.throws(
      () => resolveSatelliteOrganizationId(),
      (err: unknown) => err instanceof SatelliteOrganizationUnboundError,
    );
  });

  it("throws in production when env is demo-org", () => {
    process.env.NODE_ENV = "production";
    process.env.ERA_SATELLITE_ORGANIZATION_ID = "demo-org";
    assert.throws(
      () => resolveSatelliteOrganizationId(),
      (err: unknown) => err instanceof SatelliteOrganizationUnboundError,
    );
  });

  it("throws when setting unbound runtime id", () => {
    process.env.NODE_ENV = "development";
    assert.throws(
      () => setRuntimeOrganizationId("unbound"),
      (err: unknown) => err instanceof SatelliteOrganizationUnboundError,
    );
  });

  it("allowFallback skips production throw", () => {
    process.env.NODE_ENV = "production";
    const r = resolveSatelliteOrganizationId({ allowFallback: true });
    assert.equal(r.organizationId, "demo-org");
    assert.equal(r.source, "fallback");
  });
});

describe("onSatelliteBoot", () => {
  it("returns env source when no prisma and env set", async () => {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = "boot-env-org";
    const r = await onSatelliteBoot({ prisma: null });
    assert.equal(r.organizationId, "boot-env-org");
    assert.equal(r.source, "env");
  });

  it("hydrates from prisma into runtime", async () => {
    const prisma = {
      $executeRawUnsafe: async () => undefined,
      $queryRawUnsafe: async <T,>() =>
        [{ organizationId: "db-org-uuid" }] as unknown as T,
    };
    const r = await onSatelliteBoot({ prisma });
    assert.equal(r.organizationId, "db-org-uuid");
    assert.equal(r.source, "db");
    const resolved = resolveSatelliteOrganizationId();
    assert.equal(resolved.organizationId, "db-org-uuid");
    assert.equal(resolved.source, "runtime");
  });

  it("returns none when unbound", async () => {
    process.env.NODE_ENV = "development";
    const r = await onSatelliteBoot({ prisma: null });
    assert.equal(r.organizationId, null);
    assert.equal(r.source, "none");
  });
});
