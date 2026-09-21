import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  ORG_NO_RE,
  UUID_RE,
  assertLoginOrgRateLimit,
  clearLoginOrgNoCacheForTests,
  lookupLoginOrgNo,
  resolveLoginOrganizationId,
  upsertLoginOrgNo,
} from "./resolve-login-org";

const VALID_ORG = "104221";
const VALID_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resolve-login-org constants", () => {
  it("ORG_NO_RE accepts six-digit codes without leading zero", () => {
    assert.equal(ORG_NO_RE.test("104221"), true);
    assert.equal(ORG_NO_RE.test("100000"), true);
    assert.equal(ORG_NO_RE.test("999999"), true);
    assert.equal(ORG_NO_RE.test("012345"), false);
    assert.equal(ORG_NO_RE.test("12345"), false);
    assert.equal(ORG_NO_RE.test("1234567"), false);
  });

  it("UUID_RE matches canonical UUID strings", () => {
    assert.equal(UUID_RE.test(VALID_UUID), true);
    assert.equal(UUID_RE.test("not-a-uuid"), false);
  });
});

describe("resolveLoginOrganizationId", () => {
  const prevToken = process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  const prevOrch = process.env.ORCHESTRATOR_EVENT_URL;
  let fetchCalls = 0;

  beforeEach(() => {
    fetchCalls = 0;
    clearLoginOrgNoCacheForTests();
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "test-s2s-token";
    process.env.ORCHESTRATOR_EVENT_URL = "http://127.0.0.1:4000";
  });

  afterEach(() => {
    clearLoginOrgNoCacheForTests();
    if (prevToken === undefined) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    else process.env.SATELLITE_EVENT_SERVICE_TOKEN = prevToken;
    if (prevOrch === undefined) delete process.env.ORCHESTRATOR_EVENT_URL;
    else process.env.ORCHESTRATOR_EVENT_URL = prevOrch;
  });

  function mockFetch(status: number, body?: unknown) {
    return async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls += 1;
      assert.match(String(url), /\/internal\/v1\/organizations\/by-public-number\/104221$/);
      assert.equal(init?.method ?? "GET", "GET");
      const headers = init?.headers as Record<string, string> | undefined;
      assert.equal(headers?.Authorization, "Bearer test-s2s-token");
      return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
      } as Response;
    };
  }

  it("rejects UUID-shaped input", async () => {
    const result = await resolveLoginOrganizationId(VALID_UUID);
    assert.deepEqual(result, { invalid: true });
    assert.equal(fetchCalls, 0);
  });

  it("rejects malformed org numbers", async () => {
    assert.deepEqual(await resolveLoginOrganizationId("012345"), { invalid: true });
    assert.deepEqual(await resolveLoginOrganizationId("abc"), { invalid: true });
    assert.equal(fetchCalls, 0);
  });

  it("returns cached organizationId without fetch", async () => {
    upsertLoginOrgNo(VALID_ORG, VALID_UUID);
    const result = await resolveLoginOrganizationId(VALID_ORG, {
      fetch: mockFetch(200, { organizationId: VALID_UUID }),
    });
    assert.deepEqual(result, { organizationId: VALID_UUID });
    assert.equal(fetchCalls, 0);
    assert.equal(lookupLoginOrgNo(VALID_ORG), VALID_UUID);
  });

  it("fetches from orchestrator on cache miss and upserts map", async () => {
    const result = await resolveLoginOrganizationId(VALID_ORG, {
      fetch: mockFetch(200, { organizationId: VALID_UUID, name: "Demo Hotel" }),
    });
    assert.deepEqual(result, { organizationId: VALID_UUID });
    assert.equal(fetchCalls, 1);
    assert.equal(lookupLoginOrgNo(VALID_ORG), VALID_UUID);
  });

  it("404 miss is negative-cached for ~15s", async () => {
    const fetch404 = mockFetch(404);
    assert.deepEqual(await resolveLoginOrganizationId(VALID_ORG, { fetch: fetch404 }), {
      miss: true,
    });
    assert.equal(fetchCalls, 1);
    assert.deepEqual(await resolveLoginOrganizationId(VALID_ORG, { fetch: fetch404 }), {
      miss: true,
    });
    assert.equal(fetchCalls, 1);
  });

  it("never returns demo-org from orch response", async () => {
    const result = await resolveLoginOrganizationId(VALID_ORG, {
      fetch: mockFetch(200, { organizationId: "demo-org" }),
    });
    assert.deepEqual(result, { miss: true });
    assert.equal(lookupLoginOrgNo(VALID_ORG), undefined);
  });
});

describe("assertLoginOrgRateLimit", () => {
  beforeEach(() => {
    clearLoginOrgNoCacheForTests();
  });

  afterEach(() => {
    clearLoginOrgNoCacheForTests();
  });

  it("allows up to 20 attempts per ip+orgNo per minute", () => {
    for (let i = 0; i < 20; i += 1) {
      assert.deepEqual(assertLoginOrgRateLimit({ ip: "1.2.3.4", orgNo: "104221" }), {
        ok: true,
      });
    }
    assert.deepEqual(assertLoginOrgRateLimit({ ip: "1.2.3.4", orgNo: "104221" }), {
      ok: false,
    });
  });

  it("tracks ip and orgNo independently", () => {
    assert.deepEqual(assertLoginOrgRateLimit({ ip: "1.2.3.4", orgNo: "104221" }), {
      ok: true,
    });
    assert.deepEqual(assertLoginOrgRateLimit({ ip: "1.2.3.5", orgNo: "104221" }), {
      ok: true,
    });
    assert.deepEqual(assertLoginOrgRateLimit({ ip: "1.2.3.4", orgNo: "104222" }), {
      ok: true,
    });
  });
});
