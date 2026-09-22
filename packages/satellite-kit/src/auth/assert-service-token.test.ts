import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { assertEnvServiceToken } from "./assert-service-token";
import { recaptureInstallSatelliteEventToken } from "../tenancy/install-s2s-env";

describe("assertEnvServiceToken", () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    recaptureInstallSatelliteEventToken();
  });

  it("accepts the install token after env is stomped to folklore", () => {
    process.env.NODE_ENV = "production";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "install-real-token";
    recaptureInstallSatelliteEventToken();
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "change-me-satellite-event-token";
    const ok = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: "Bearer install-real-token",
    });
    assert.equal(ok.ok, true);
  });
});
