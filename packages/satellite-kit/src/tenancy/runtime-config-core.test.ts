import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  applySatelliteRuntimeConfig,
  onSatelliteRuntimeBoot,
  resetRuntimeConfigForTests,
} from "./runtime-config-core";
import {
  getRuntimeConfigMemory,
  setRuntimeConfigMemory,
} from "./runtime-config-memory";

describe("applySatelliteRuntimeConfig", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
    delete process.env.ERA_RUNTIME_CONFIG_FILE;
  });

  it("does not wipe a real event token when the Sync patch omits secrets", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "era-rtc-"));
    process.env.ERA_RUNTIME_CONFIG_FILE = path.join(dir, "runtime-config.json");
    setRuntimeConfigMemory({ satelliteEventServiceToken: "keep-this-real-token" });
    const next = await applySatelliteRuntimeConfig({
      config: { orchestratorEventUrl: "http://orchestrator:4000" },
    });
    assert.equal(next.satelliteEventServiceToken, "keep-this-real-token");
    assert.equal(getRuntimeConfigMemory().satelliteEventServiceToken, "keep-this-real-token");
  });
});

describe("onSatelliteRuntimeBoot", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
    delete process.env.ERA_RUNTIME_CONFIG_FILE;
    delete process.env.ERA_IN_DOCKER;
  });

  it("lets DB desired state win over a stale runtime-config.json", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "era-rtc-"));
    const file = path.join(dir, "runtime-config.json");
    process.env.ERA_RUNTIME_CONFIG_FILE = file;
    process.env.ERA_IN_DOCKER = "1";
    fs.writeFileSync(
      file,
      JSON.stringify({
        orchestratorEventUrl: "https://api.era-365.online",
        satelliteEventServiceToken: "change-me-stale",
      }),
    );
    const prisma = {
      $executeRawUnsafe: async () => undefined,
      $queryRawUnsafe: async () => [
        {
          configJson: JSON.stringify({
            orchestratorEventUrl: "http://orchestrator:4000",
            satelliteEventServiceToken: "db-real-token",
          }),
        },
      ],
    };
    const cfg = await onSatelliteRuntimeBoot({ prisma: prisma as never });
    assert.equal(cfg.orchestratorEventUrl, "http://orchestrator:4000");
    assert.equal(cfg.satelliteEventServiceToken, "db-real-token");
  });
});
