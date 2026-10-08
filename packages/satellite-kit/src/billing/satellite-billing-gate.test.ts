import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  assertSatelliteBillingAllows,
  resetSatelliteBillingCacheForTests,
  resolveSatelliteBillingStatus,
  SatelliteBillingBlockedError,
  seedSatelliteBillingCacheForTests,
} from "./satellite-billing-gate";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const realFetch = globalThis.fetch;

type Call = { url: string; body: Record<string, unknown> };

function stubFetch(reply: (body: Record<string, unknown>) => unknown | Error) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ url: String(url), body });
    const out = reply(body);
    if (out instanceof Error) throw out;
    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

describe("assertSatelliteBillingAllows", () => {
  beforeEach(() => {
    resetSatelliteBillingCacheForTests();
    process.env.ERA_BILLING_ENFORCEMENT = "on";
    process.env.ORCHESTRATOR_URL = "http://orch.test";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.ERA_BILLING_ENFORCEMENT;
    delete process.env.ORCHESTRATOR_URL;
  });

  it("asks the orchestrator validate route with method and path", async () => {
    const calls = stubFetch(() => ({ allowed: true, billingStatus: "ACTIVE" }));
    assert.equal(
      await assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/x" }),
      "ACTIVE",
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/internal\/v1\/entitlements\/validate$/);
    assert.deepEqual(calls[0].body, { organizationId: ORG, method: "POST", path: "/api/x" });
  });

  it("caches ACTIVE and skips the next call", async () => {
    const calls = stubFetch(() => ({ allowed: true, billingStatus: "ACTIVE" }));
    await assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/a" });
    await assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/b" });
    assert.equal(calls.length, 1);
  });

  it("throws 402 with the orchestrator code when denied", async () => {
    stubFetch(() => ({
      allowed: false,
      billingStatus: "HARD_BLOCK",
      code: "BILLING_HARD_BLOCK_READ_ONLY",
      message: "read-only",
      httpStatus: 402,
    }));
    await assert.rejects(
      assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/folio" }),
      (err: unknown) =>
        err instanceof SatelliteBillingBlockedError &&
        err.status === 402 &&
        err.code === "BILLING_HARD_BLOCK_READ_ONLY" &&
        err.billingStatus === "HARD_BLOCK",
    );
  });

  it("re-asks every call while the org is blocked", async () => {
    const calls = stubFetch((b) =>
      b.method === "GET"
        ? { allowed: true, billingStatus: "HARD_BLOCK" }
        : { allowed: false, billingStatus: "HARD_BLOCK", code: "BILLING_HARD_BLOCK_READ_ONLY" },
    );
    await assertSatelliteBillingAllows({ organizationId: ORG, method: "GET", path: "/api/a" });
    await assert.rejects(
      assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/a" }),
    );
    assert.equal(calls.length, 2);
  });

  it("orchestrator down, no cache: reads pass, writes get 503", async () => {
    stubFetch(() => new Error("ECONNREFUSED"));
    assert.equal(
      await assertSatelliteBillingAllows({ organizationId: ORG, method: "GET", path: "/api/a" }),
      "ACTIVE",
    );
    await assert.rejects(
      assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/a" }),
      (err: unknown) =>
        err instanceof SatelliteBillingBlockedError &&
        err.status === 503 &&
        err.code === "BILLING_STATUS_UNAVAILABLE",
    );
  });

  it("orchestrator down: a cached HARD_BLOCK still blocks writes", async () => {
    seedSatelliteBillingCacheForTests(ORG, "HARD_BLOCK", 120_000);
    stubFetch(() => new Error("ECONNREFUSED"));
    await assert.rejects(
      assertSatelliteBillingAllows({ organizationId: ORG, method: "DELETE", path: "/api/a" }),
      (err: unknown) => err instanceof SatelliteBillingBlockedError && err.status === 402,
    );
    assert.equal(
      await assertSatelliteBillingAllows({ organizationId: ORG, method: "GET", path: "/api/a" }),
      "HARD_BLOCK",
    );
  });

  it("orchestrator down: /api/auth/* writes stay open like the orchestrator matrix", async () => {
    seedSatelliteBillingCacheForTests(ORG, "HARD_BLOCK", 120_000);
    stubFetch(() => new Error("ECONNREFUSED"));
    assert.equal(
      await assertSatelliteBillingAllows({
        organizationId: ORG,
        method: "POST",
        path: "/api/auth/change-password",
      }),
      "HARD_BLOCK",
    );
    resetSatelliteBillingCacheForTests();
    assert.equal(
      await assertSatelliteBillingAllows({
        organizationId: ORG,
        method: "POST",
        path: "/api/auth/logout",
      }),
      "ACTIVE",
    );
  });

  it("orchestrator down: a cached ACTIVE past its TTL still allows writes", async () => {
    seedSatelliteBillingCacheForTests(ORG, "ACTIVE", 120_000);
    stubFetch(() => new Error("ECONNREFUSED"));
    assert.equal(
      await assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/a" }),
      "ACTIVE",
    );
  });

  it("is off when ERA_BILLING_ENFORCEMENT=off outside production", async () => {
    process.env.ERA_BILLING_ENFORCEMENT = "off";
    const calls = stubFetch(() => ({ allowed: false, billingStatus: "HARD_BLOCK" }));
    assert.equal(
      await assertSatelliteBillingAllows({ organizationId: ORG, method: "POST", path: "/api/a" }),
      "ACTIVE",
    );
    assert.equal(calls.length, 0);
  });

  it("resolveSatelliteBillingStatus returns the banner status via a GET check", async () => {
    const calls = stubFetch(() => ({ allowed: true, billingStatus: "SOFT_BLOCK" }));
    assert.equal(await resolveSatelliteBillingStatus(ORG), "SOFT_BLOCK");
    assert.equal(calls[0].body.method, "GET");
  });
});
