import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  rewriteComposeHostnameForHost,
  resolveOrchestratorBaseUrl,
} from "./resolve-orchestrator-url";
import { resetRuntimeConfigMemoryForTests } from "./runtime-config-memory";

afterEach(() => {
  delete process.env.ERA_IN_DOCKER;
  delete process.env.ORCHESTRATOR_EVENT_URL;
  delete process.env.ORCHESTRATOR_URL;
  delete process.env.CONTROL_PLANE_URL;
  resetRuntimeConfigMemoryForTests();
});

describe("rewriteComposeHostnameForHost", () => {
  it("rewrites orchestrator DNS to loopback on the host", () => {
    process.env.ERA_IN_DOCKER = "0";
    assert.equal(
      rewriteComposeHostnameForHost("http://orchestrator:4000"),
      "http://127.0.0.1:4000",
    );
  });

  it("leaves compose DNS unchanged inside Docker", () => {
    process.env.ERA_IN_DOCKER = "1";
    assert.equal(
      rewriteComposeHostnameForHost("http://orchestrator:4000"),
      "http://orchestrator:4000",
    );
  });

  it("does not rewrite already-loopback URLs", () => {
    process.env.ERA_IN_DOCKER = "0";
    assert.equal(
      rewriteComposeHostnameForHost("http://127.0.0.1:4000"),
      "http://127.0.0.1:4000",
    );
  });
});

describe("resolveOrchestratorBaseUrl", () => {
  it("rewrites env compose URL when running on the host", () => {
    process.env.ERA_IN_DOCKER = "0";
    process.env.ORCHESTRATOR_EVENT_URL = "http://orchestrator:4000";
    assert.equal(resolveOrchestratorBaseUrl(), "http://127.0.0.1:4000");
  });
});
