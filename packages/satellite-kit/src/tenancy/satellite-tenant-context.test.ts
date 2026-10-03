import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, describe, it } from "node:test";
import {
  SatelliteOrganizationUnboundError,
  clearProcessOrganizationBind,
  getRuntimeOrganizationId,
  resetOrganizationBindRuntimeForTests,
  setRuntimeOrganizationId,
} from "./organization-bind-runtime";
import {
  enterSatelliteTenant,
  getSatelliteTenantContext,
  organizationIdOnIncomingRequest,
  peekSatelliteRequestOrganizationId,
  resolveSatelliteTenantOrgId,
  runWithSatelliteTenant,
} from "./satellite-tenant-context";

const nodeRequire = createRequire(__filename);
const HEADER_ORG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STORE_ORG = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PROCESS_ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORK_STORE = "next/dist/server/app-render/work-unit-async-storage.external";

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

describe("org after ALS is dropped", () => {
  const envKeys = [
    "ERA_SATELLITE_ORGANIZATION_ID",
    "ERA_BANK_ORGANIZATION_ID",
    "ORGANIZATION_ID",
  ] as const;
  let savedEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
  let savedRuntime: string | null = null;
  const stubbed: { path: string; previous: NodeJS.Module | undefined }[] = [];

  function blankAls<T>(fn: () => T): T {
    return runWithSatelliteTenant({ organizationId: " " }, fn);
  }

  function stub(specifier: string, exports: unknown): void {
    const path = nodeRequire.resolve(specifier);
    stubbed.push({ path, previous: nodeRequire.cache[path] });
    nodeRequire.cache[path] = {
      id: path,
      filename: path,
      loaded: true,
      exports,
    } as NodeJS.Module;
  }

  afterEach(() => {
    for (const entry of stubbed.splice(0)) {
      if (entry.previous) nodeRequire.cache[entry.path] = entry.previous;
      else delete nodeRequire.cache[entry.path];
    }
    resetOrganizationBindRuntimeForTests();
    if (savedRuntime) setRuntimeOrganizationId(savedRuntime);
    for (const key of envKeys) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function dropProcessBind(): void {
    savedRuntime = getRuntimeOrganizationId();
    savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    clearProcessOrganizationBind();
  }

  it("throws inside a Next request when the tenant was not entered", () => {
    stub(WORK_STORE, {
      workUnitAsyncStorage: { getStore: () => ({}) },
    });
    setRuntimeOrganizationId(PROCESS_ORG);
    assert.throws(
      () => blankAls(() => resolveSatelliteTenantOrgId()),
      SatelliteOrganizationUnboundError,
    );
  });

  it("reads the org remembered on the Next request store when ALS is empty", () => {
    const requestStore = {};
    stub("next/headers", {
      headers: () => ({
        get: () => null,
      }),
    });
    stub(WORK_STORE, {
      workUnitAsyncStorage: { getStore: () => requestStore },
    });
    dropProcessBind();
    enterSatelliteTenant({ organizationId: STORE_ORG });
    assert.equal(blankAls(() => resolveSatelliteTenantOrgId()), STORE_ORG);
  });

  it("peek ignores the process bind when the request has no org", () => {
    stub("next/headers", {
      headers: () => Promise.resolve({ get: () => HEADER_ORG }),
    });
    setRuntimeOrganizationId(PROCESS_ORG);
    const incoming = new Request("http://localhost/api/events/dispatch", {
      headers: { "x-era-organization-id": HEADER_ORG },
    });
    assert.equal(blankAls(() => peekSatelliteRequestOrganizationId()), undefined);
    assert.equal(blankAls(() => organizationIdOnIncomingRequest(incoming)), HEADER_ORG);
    assert.equal(
      blankAls(() => resolveSatelliteTenantOrgId()),
      PROCESS_ORG,
    );
  });
});
