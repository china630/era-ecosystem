/**
 * Unit tests for 3-tier token layer lint.
 * Run: node --test scripts/__tests__/token-layers.spec.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lintScript = path.join(root, "scripts/lint-token-layers.mjs");

function runLint(args = []) {
  return spawnSync(process.execPath, [lintScript, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("lint-token-layers.mjs", () => {
  it("exits 0 when L1/L2/L3 are aligned", () => {
    const r = runLint([]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /OK - layers aligned/);
  });

  it("--json reports l1Count and empty errors", () => {
    const r = runLint(["--json"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.l1Count >= 8);
    assert.equal(parsed.errors.length, 0);
  });
});
