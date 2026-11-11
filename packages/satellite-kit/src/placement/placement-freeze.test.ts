import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  isOrganizationPlacementFrozen,
  placementFrozenWriteResponse,
} from "./placement-freeze";
import {
  resetRuntimeConfigMemoryForTests,
  setRuntimeConfigMemory,
} from "../tenancy/runtime-config-memory";

describe("placement-freeze", () => {
  const prevEnv = process.env.ERA_PLACEMENT_FROZEN_ORG_IDS;

  beforeEach(() => {
    resetRuntimeConfigMemoryForTests();
    delete process.env.ERA_PLACEMENT_FROZEN_ORG_IDS;
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.ERA_PLACEMENT_FROZEN_ORG_IDS;
    else process.env.ERA_PLACEMENT_FROZEN_ORG_IDS = prevEnv;
    setRuntimeConfigMemory({});
  });

  it("reads env frozen org ids", () => {
    process.env.ERA_PLACEMENT_FROZEN_ORG_IDS =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    assert.equal(
      isOrganizationPlacementFrozen("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      true,
    );
    assert.equal(
      isOrganizationPlacementFrozen("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      false,
    );
  });

  it("reads placementFrozenOrgIds from runtime config", () => {
    setRuntimeConfigMemory({
      placementFrozenOrgIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    });
    assert.equal(
      isOrganizationPlacementFrozen("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      true,
    );
  });

  it("returns 423 Response for writes when frozen", () => {
    setRuntimeConfigMemory({
      placementFreeze: true,
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const res = placementFrozenWriteResponse({
      method: "POST",
      pathname: "/api/guests",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.ok(res);
    assert.equal(res!.status, 423);
  });

  it("allows placement internal writes while frozen", () => {
    setRuntimeConfigMemory({ placementFreeze: true });
    const res = placementFrozenWriteResponse({
      method: "POST",
      pathname: "/api/internal/v1/placement/import-slice",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.equal(res, null);
  });
});
