import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearLoginOrgNoCacheForTests,
  upsertLoginOrgNo,
} from "./resolve-login-org";
import {
  clearLoginHostnameCacheForTests,
  upsertLoginHostname,
} from "../tenancy/login-hostname-memory";
import {
  describeLoginHostBinding,
  readStaffLoginJson,
  resolveStaffLoginTenant,
} from "./staff-login-org";

const VALID_ORG = "104221";
const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function mockRequest(ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/auth/login", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("resolveStaffLoginTenant", () => {
  it("SHARED requires orgNo", async () => {
    const r = await resolveStaffLoginTenant({
      isShared: true,
      request: mockRequest(),
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 400);
  });

  it("DEDICATED allows omitting orgNo", async () => {
    const r = await resolveStaffLoginTenant({
      isShared: false,
      request: mockRequest(),
    });
    assert.deepEqual(r, { ok: true, organizationId: undefined });
  });

  it("miss returns 401 invalid credentials", async () => {
    clearLoginOrgNoCacheForTests();
    const r = await resolveStaffLoginTenant({
      orgNo: VALID_ORG,
      isShared: true,
      request: mockRequest(),
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
    assert.equal(r.error, "Invalid credentials");
  });

  it("SHARED custom login host binds tenant without orgNo", async () => {
    clearLoginHostnameCacheForTests();
    upsertLoginHostname("pms.client.az", {
      organizationId: VALID_UUID,
      satelliteKey: "industry_hotel_pms",
      kind: "satellite_login",
      status: "ACTIVE",
    });
    const r = await resolveStaffLoginTenant({
      isShared: true,
      satelliteKey: "industry_hotel_pms",
      request: new Request("http://pms.client.az/api/auth/login", {
        headers: { host: "pms.client.az" },
      }),
    });
    assert.deepEqual(r, { ok: true, organizationId: VALID_UUID });
  });

  it("describeLoginHostBinding hides field on ERA subdomain Host", () => {
    const prev = process.env.ERA_LOGIN_POOL_HOSTS;
    process.env.ERA_LOGIN_POOL_HOSTS = "clinic.era-365.online";
    try {
      const binding = describeLoginHostBinding(
        new Request("http://104221.clinic.era-365.online/api/auth/login", {
          headers: { host: "104221.clinic.era-365.online" },
        }),
      );
      assert.deepEqual(binding, { hostBound: true, orgNo: "104221" });
    } finally {
      if (prev === undefined) delete process.env.ERA_LOGIN_POOL_HOSTS;
      else process.env.ERA_LOGIN_POOL_HOSTS = prev;
    }
  });

  it("resolves cached orgNo to UUID", async () => {
    clearLoginOrgNoCacheForTests();
    upsertLoginOrgNo(VALID_ORG, VALID_UUID);
    const r = await resolveStaffLoginTenant({
      orgNo: VALID_ORG,
      isShared: true,
      request: mockRequest(),
    });
    assert.deepEqual(r, {
      ok: true,
      organizationId: VALID_UUID,
      orgNo: VALID_ORG,
    });
  });

  it("SHARED custom login host rejects unknown orgNo (does not ignore miss)", async () => {
    clearLoginHostnameCacheForTests();
    clearLoginOrgNoCacheForTests();
    upsertLoginHostname("pms.client.az", {
      organizationId: VALID_UUID,
      satelliteKey: "industry_hotel_pms",
      kind: "satellite_login",
      status: "ACTIVE",
    });
    const r = await resolveStaffLoginTenant({
      orgNo: "204222",
      isShared: true,
      satelliteKey: "industry_hotel_pms",
      request: new Request("http://pms.client.az/api/auth/login", {
        headers: { host: "pms.client.az" },
      }),
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 401);
  });

  it("describeLoginHostBinding does not advertise custom white-label Host", () => {
    clearLoginHostnameCacheForTests();
    upsertLoginHostname("pms.client.az", {
      organizationId: VALID_UUID,
      satelliteKey: "industry_hotel_pms",
      kind: "satellite_login",
      status: "ACTIVE",
    });
    const binding = describeLoginHostBinding(
      new Request("http://pms.client.az/api/auth/login", {
        headers: { host: "pms.client.az" },
      }),
    );
    assert.deepEqual(binding, { hostBound: false });
  });

  it("readStaffLoginJson rejects leftover organizationId UUID field", async () => {
    const r = await readStaffLoginJson(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: "a",
          password: "b",
          organizationId: VALID_UUID,
        }),
      }),
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 400);
  });
});
