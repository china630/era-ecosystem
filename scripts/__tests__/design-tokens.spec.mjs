/**
 * Unit tests for design token lint baseline logic.
 * Run: node --test scripts/__tests__/design-tokens.spec.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lintScript = path.join(root, "scripts/lint-design-tokens.mjs");
const baselinePath = path.join(root, "scripts/baselines/design-token-baseline.json");

function runLint(args = []) {
  return spawnSync(process.execPath, [lintScript, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("lint-design-tokens.mjs", () => {
  it("exits 0 with --update-baseline and writes baseline JSON", () => {
    const r = runLint(["--update-baseline"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(fs.existsSync(baselinePath));
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    assert.ok(baseline.totals);
    assert.ok(typeof baseline.totals["raw-input-no-token"] === "number");
    assert.ok(baseline.generatedAt);
  });

  it("exits 0 when counts match baseline (no regression)", () => {
    runLint(["--update-baseline"]);
    const r = runLint([]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /No regressions vs baseline/);
  });

  it("--json outputs structured report", () => {
    const r = runLint(["--json"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.report?.totals);
    assert.ok(parsed.baseline?.totals);
  });
});
