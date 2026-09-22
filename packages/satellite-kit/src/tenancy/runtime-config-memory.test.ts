import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  applyEnvSideEffects,
  resetRuntimeConfigMemoryForTests,
} from "./runtime-config-memory";

describe("applyEnvSideEffects folklore skip", () => {
  afterEach(() => {
    resetRuntimeConfigMemoryForTests();
  });

  it("does not stomp install SATELLITE_EVENT_SERVICE_TOKEN with change-me", () => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "install-real-token";
    applyEnvSideEffects({
      satelliteEventServiceToken: "change-me-satellite-event-token",
    });
    assert.equal(process.env.SATELLITE_EVENT_SERVICE_TOKEN, "install-real-token");
  });
});
