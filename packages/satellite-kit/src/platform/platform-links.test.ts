import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  resetRuntimeConfigMemoryForTests,
  setRuntimeConfigMemory,
} from "../tenancy/runtime-config-memory";
import { buildPlatformLinks, readPlatformLinks } from "./platform-links";

describe("platform-links", () => {
  afterEach(() => {
    resetRuntimeConfigMemoryForTests();
    delete process.env.ERA_APP_ORIGIN;
    delete process.env.NEXT_PUBLIC_ORCH_WEB_URL;
    delete process.env.ERA_IN_DOCKER;
    delete process.env.NODE_ENV;
  });

  it("builds app URLs from Sync orchestratorPublicBaseUrl", () => {
    setRuntimeConfigMemory({
      orchestratorPublicBaseUrl: "https://app.era-365.online",
    });
    const body = buildPlatformLinks();
    assert.equal(body.appOrigin, "https://app.era-365.online");
    assert.equal(body.registerUrl, "https://app.era-365.online/register");
    assert.equal(body.registerOrgUrl, "https://app.era-365.online/register-org");
    assert.equal(readPlatformLinks().status, 200);
  });

  it("returns 503 without localhost when production has no origin", () => {
    process.env.NODE_ENV = "production";
    process.env.ERA_IN_DOCKER = "1";
    const result = readPlatformLinks();
    assert.equal(result.status, 503);
    const body = result.body as { appOrigin: string | null; registerUrl: string | null };
    assert.equal(body.appOrigin, null);
    assert.equal(body.registerUrl, null);
  });
});
