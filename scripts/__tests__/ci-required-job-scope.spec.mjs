import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jobShouldRun, forcesFullCi } from "../ci-required-job-scope.mjs";

describe("jobShouldRun", () => {
  it("always runs orchestrator", () => {
    assert.equal(jobShouldRun("orchestrator", ["era-clinic/a.ts"]), true);
  });

  it("stubs finance and other satellites for a clinic-only diff", () => {
    const files = ["era-clinic/app/page.tsx"];
    assert.equal(jobShouldRun("era-clinic", files), true);
    assert.equal(jobShouldRun("finance", files), false);
    assert.equal(jobShouldRun("era-hotel-pms", files), false);
    assert.equal(jobShouldRun("data-hub", files), false);
    assert.equal(jobShouldRun("bank-core", files), false);
    assert.equal(jobShouldRun("era-bank", files), false);
    assert.equal(jobShouldRun("era-bank-dbo", files), false);
  });

  it("does not treat era-bank-core as era-bank", () => {
    const files = ["era-bank-core/src/main.ts"];
    assert.equal(jobShouldRun("bank-core", files), true);
    assert.equal(jobShouldRun("era-bank", files), false);
  });

  it("runs every job when packages, workflows, docker, or a lockfile change", () => {
    for (const file of [
      "packages/satellite-kit/src/index.ts",
      ".github/workflows/ci.yml",
      "docker/scripts/deploy-droplet.sh",
      "package-lock.json",
      "era-clinic/package-lock.json",
    ]) {
      assert.equal(forcesFullCi(file), true, file);
      assert.equal(jobShouldRun("finance", [file]), true, file);
    }
  });

  it("runs every job for an empty diff or ci-full", () => {
    assert.equal(jobShouldRun("finance", []), true);
    assert.equal(jobShouldRun("finance", ["era-clinic/a.ts"], { full: true }), true);
  });

  it("runs an unknown job key", () => {
    assert.equal(jobShouldRun("not-a-job", ["era-clinic/a.ts"]), true);
  });
});
