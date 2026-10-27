import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearPeerSatelliteUrlCache,
  PeerSatelliteUrlError,
  resolvePeerSatelliteBaseUrl,
} from "./resolve-peer-satellite-url";

describe("resolvePeerSatelliteBaseUrl", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    clearPeerSatelliteUrlCache();
    for (const k of [
      "NODE_ENV",
      "ERA_PEER_URL_ENV_FALLBACK",
      "SATELLITE_EVENT_SERVICE_TOKEN",
      "CONTROL_PLANE_URL",
      "HOTEL_PMS_URL",
      "ERA_HOTEL_PMS_INTERNAL_URL",
    ]) {
      prev[k] = process.env[k];
    }
    process.env.NODE_ENV = "test";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "test-sat-token-16chars";
    process.env.CONTROL_PLANE_URL = "http://127.0.0.1:4000";
    delete process.env.ERA_PEER_URL_ENV_FALLBACK;
    delete process.env.HOTEL_PMS_URL;
    delete process.env.ERA_HOTEL_PMS_INTERNAL_URL;
  });

  afterEach(() => {
    clearPeerSatelliteUrlCache();
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("uses CP peer-endpoint when fetch succeeds", async () => {
    const resolved = await resolvePeerSatelliteBaseUrl({
      organizationId: "org-1",
      satelliteKey: "industry_hotel_pms",
      orchestratorBaseUrl: "http://orch.test",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            baseUrl: "http://hotel-pms:3201",
            source: "registry",
          }),
          { status: 200 },
        ),
    });
    assert.equal(resolved.baseUrl, "http://hotel-pms:3201");
    assert.equal(resolved.source, "registry");
  });

  it("falls back to env in non-production when CP fails", async () => {
    process.env.HOTEL_PMS_URL = "http://127.0.0.1:3201/";
    const resolved = await resolvePeerSatelliteBaseUrl({
      organizationId: "org-1",
      satelliteKey: "industry_hotel_pms",
      orchestratorBaseUrl: "http://orch.test",
      fetchImpl: async () => new Response("no", { status: 404 }),
    });
    assert.equal(resolved.baseUrl, "http://127.0.0.1:3201");
    assert.equal(resolved.source, "env_fallback");
  });

  it("fail-closed in production without registry or ERA_PEER_URL_ENV_FALLBACK", async () => {
    process.env.NODE_ENV = "production";
    process.env.HOTEL_PMS_URL = "http://127.0.0.1:3201";
    await assert.rejects(
      () =>
        resolvePeerSatelliteBaseUrl({
          organizationId: "org-1",
          satelliteKey: "industry_hotel_pms",
          orchestratorBaseUrl: "http://orch.test",
          fetchImpl: async () => new Response("no", { status: 404 }),
        }),
      (e: unknown) => e instanceof PeerSatelliteUrlError && e.code === "PEER_UNRESOLVED",
    );
  });

  it("allows env in production when ERA_PEER_URL_ENV_FALLBACK=1", async () => {
    process.env.NODE_ENV = "production";
    process.env.ERA_PEER_URL_ENV_FALLBACK = "1";
    process.env.ERA_HOTEL_PMS_INTERNAL_URL = "http://hotel-pms:3201";
    const resolved = await resolvePeerSatelliteBaseUrl({
      organizationId: "org-1",
      satelliteKey: "industry_hotel_pms",
      orchestratorBaseUrl: "http://orch.test",
      fetchImpl: async () => new Response("no", { status: 503 }),
    });
    assert.equal(resolved.baseUrl, "http://hotel-pms:3201");
  });

  it("caches successful resolve", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ baseUrl: "http://hotel-pms:3201", source: "registry" }),
        { status: 200 },
      );
    };
    await resolvePeerSatelliteBaseUrl({
      organizationId: "org-1",
      satelliteKey: "industry_hotel_pms",
      orchestratorBaseUrl: "http://orch.test",
      fetchImpl,
    });
    const second = await resolvePeerSatelliteBaseUrl({
      organizationId: "org-1",
      satelliteKey: "industry_hotel_pms",
      orchestratorBaseUrl: "http://orch.test",
      fetchImpl,
    });
    assert.equal(calls, 1);
    assert.equal(second.source, "cache");
  });
});
