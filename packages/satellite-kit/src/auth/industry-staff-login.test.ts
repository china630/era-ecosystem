import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { authenticateIndustryStaffLogin, openStaffLogin } from "./industry-staff-login";
import { hashPassword } from "./password";
import { clearLoginOrgNoCacheForTests, upsertLoginOrgNo } from "./resolve-login-org";
import { getSatelliteTenantContext } from "../tenancy/satellite-tenant-context";

const ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function post(body: unknown): Request {
  return new Request("http://hotel.example/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", host: "hotel.example" },
    body: JSON.stringify(body),
  });
}

describe("industry staff login prefix", () => {
  beforeEach(() => {
    clearLoginOrgNoCacheForTests();
    upsertLoginOrgNo("178260", ORG);
  });

  it("enters the tenant before the user lookup", async () => {
    let seen: string | undefined;
    const prisma = {
      user: {
        findFirst: async () => {
          seen = getSatelliteTenantContext()?.organizationId;
          return null;
        },
      },
    };
    const result = await authenticateIndustryStaffLogin({
      request: post({ login: "reception", password: "secret", orgNo: "178260" }),
      prisma,
      isShared: true,
    });
    assert.equal(seen, ORG);
    assert.deepEqual(result, { ok: false, status: 401, error: "Invalid credentials" });
  });

  it("does not query users when orgNo is missing", async () => {
    let called = false;
    const prisma = {
      user: {
        findFirst: async () => {
          called = true;
          return null;
        },
      },
    };
    const result = await authenticateIndustryStaffLogin({
      request: post({ login: "reception", password: "secret" }),
      prisma,
      isShared: true,
    });
    assert.equal(called, false);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });

  it("returns the user after the password matches", async () => {
    const passwordHash = await hashPassword("secret");
    const prisma = {
      user: {
        findFirst: async () => ({
          id: "user-1",
          login: "reception",
          email: null,
          phone: null,
          fullName: "Reception",
          passwordHash,
          status: "ACTIVE",
          organizationId: ORG,
          role: { code: "Receptionist" },
        }),
      },
    };
    const result = await authenticateIndustryStaffLogin({
      request: post({ login: "reception", password: "secret", orgNo: "178260" }),
      prisma,
      isShared: false,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.organizationId, ORG);
      assert.equal(result.user.login, "reception");
    }
  });

  it("openStaffLogin returns the org and leaves the tenant bind to the caller", async () => {
    const opened = await openStaffLogin({
      request: post({ login: "teller", password: "secret", orgNo: "178260" }),
      isShared: false,
    });
    assert.equal(opened.ok, true);
    if (opened.ok) {
      assert.equal(opened.organizationId, ORG);
      assert.equal(opened.login, "teller");
    }
    assert.equal(getSatelliteTenantContext()?.organizationId, undefined);
  });
});
