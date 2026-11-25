/**
 * Construction Nest native Controllers — wiring smoke (no live HTTP listen).
 */
import "reflect-metadata";
import { describe, expect, it } from "@jest/globals";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { HealthController } from "../nest/native/controllers/health.controller";
import { expressCookieFromSeconds } from "../nest/native/cookie-opts";

describe("Construction Nest native Controllers", () => {
  it("ships the expected controller files", () => {
    const dir = join(__dirname, "..", "nest", "native", "controllers");
    const files = readdirSync(dir).filter((f) => f.endsWith(".controller.ts")).sort();
    expect(files).toEqual(
      expect.arrayContaining([
        "admin.controller.ts",
        "auth.controller.ts",
        "estimate.controller.ts",
        "health.controller.ts",
        "projects.controller.ts",
        "progress-acts.controller.ts",
        "scaffold.controller.ts",
      ]),
    );
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it("HealthController returns service identity", () => {
    const ctl = new HealthController();
    expect(ctl.health()).toEqual({ ok: true, service: "era-construction" });
  });

  it("expressCookieFromSeconds converts kit/Next maxAge seconds to Express ms", () => {
    expect(expressCookieFromSeconds({ maxAge: 60 * 60 * 8 }).maxAge).toBe(8 * 60 * 60 * 1000);
  });
});
