import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { findUserByCredential } from "./login-user";
import {
  resetOrganizationBindForTests,
  setRuntimeOrganizationId,
} from "../tenancy/organization-bind-core";

describe("findUserByCredential org scope", () => {
  const prevSkip = process.env.ERA_SKIP_TENANT_FILTER;
  const calls: unknown[] = [];

  beforeEach(() => {
    calls.length = 0;
    delete process.env.ERA_SKIP_TENANT_FILTER;
    resetOrganizationBindForTests();
  });

  afterEach(() => {
    if (prevSkip === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prevSkip;
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

  it("without org uses process bind only (never cross-org)", async () => {
    setRuntimeOrganizationId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await findUserByCredential(mockPrisma(), "reception");
    assert.equal(calls.length, 1);
    const where = (calls[0] as { where: { organizationId: string } }).where;
    assert.equal(where.organizationId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
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

  it("without org in non-production scopes to demo-org fallback (still not cross-org)", async () => {
    delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    delete process.env.ERA_BANK_ORGANIZATION_ID;
    delete process.env.ORGANIZATION_ID;
    await findUserByCredential(mockPrisma(), "reception");
    assert.equal(calls.length, 1);
    const where = (calls[0] as { where: { organizationId: string } }).where;
    assert.equal(where.organizationId, "demo-org");
  });
});
