import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { findUserByCredential } from "./login-user";
import { resetOrganizationBindForTests } from "../tenancy/organization-bind-core";

describe("findUserByCredential org scope", () => {
  const calls: unknown[] = [];

  beforeEach(() => {
    calls.length = 0;
    resetOrganizationBindForTests();
  });

  afterEach(() => {
    resetOrganizationBindForTests();
  });

  function mockPrisma() {
    return {
      user: {
        findFirst: async (args: unknown) => {
          calls.push(args);
          return null;
        },
      },
    };
  }

  it("scopes findFirst to explicit organizationId", async () => {
    await findUserByCredential(
      mockPrisma(),
      "reception",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    assert.equal(calls.length, 1);
    const where = (calls[0] as { where: { organizationId: string } }).where;
    assert.equal(where.organizationId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("without org returns null even when the process bind is set", async () => {
    const { setRuntimeOrganizationId } = await import("../tenancy/organization-bind-core");
    setRuntimeOrganizationId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const row = await findUserByCredential(mockPrisma(), "reception");
    assert.equal(row, null);
    assert.equal(calls.length, 0);
  });

  it("returns null when unbound in production (no cross-org find)", async () => {
    const prevNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    delete process.env.ERA_BANK_ORGANIZATION_ID;
    delete process.env.ORGANIZATION_ID;
    try {
      const row = await findUserByCredential(mockPrisma(), "reception");
      assert.equal(row, null);
      assert.equal(calls.length, 0);
    } finally {
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
    }
  });

  it("without org when unbound returns null (never demo-org)", async () => {
    delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    delete process.env.ERA_BANK_ORGANIZATION_ID;
    delete process.env.ORGANIZATION_ID;
    const row = await findUserByCredential(mockPrisma(), "reception");
    assert.equal(row, null);
    assert.equal(calls.length, 0);
  });
});
