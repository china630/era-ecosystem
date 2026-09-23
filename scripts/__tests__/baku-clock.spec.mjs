/**
 * Unit tests for Asia/Baku clock lint.
 * Run: node --test scripts/__tests__/baku-clock.spec.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanBakuClockText } from "../lint-baku-clock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lintScript = path.join(root, "scripts/lint-baku-clock.mjs");

function runLint(args = []) {
  return spawnSync(process.execPath, [lintScript, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("scanBakuClockText", () => {
  it("flags utc-today", () => {
    const hits = scanBakuClockText(`const d = new Date().toISOString().slice(0, 10);\n`);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].rule, "utc-today");
  });

  it("flags utc-today-offset", () => {
    const hits = scanBakuClockText(
      `const d = new Date(Date.now() + 86400000).toISOString().slice(0, 10);\n`,
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].rule, "utc-today-offset");
  });

  it("flags locale-no-tz on Date", () => {
    const hits = scanBakuClockText(`{new Date(x).toLocaleString()}\n`);
    assert.equal(hits.some((h) => h.rule === "locale-no-tz"), true);
  });

  it("allows toLocale with timeZone Asia/Baku", () => {
    const hits = scanBakuClockText(
      `d.toLocaleString("en-GB", { timeZone: "Asia/Baku", hour: "2-digit" });\n`,
    );
    assert.equal(hits.filter((h) => h.rule === "locale-no-tz").length, 0);
  });

  it("allows toLocale with timeZone UTC", () => {
    const hits = scanBakuClockText(
      `d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short" });\n`,
    );
    assert.equal(hits.filter((h) => h.rule === "locale-no-tz").length, 0);
  });

  it("skips number toLocaleString with fraction digits", () => {
    const hits = scanBakuClockText(
      `return n.toLocaleString(undefined, { maximumFractionDigits: 4 });\n`,
    );
    assert.equal(hits.length, 0);
  });

  it("skips number toLocaleString locale-only", () => {
    const hits = scanBakuClockText(`THRESHOLD.toLocaleString("en-US")\n`);
    assert.equal(hits.length, 0);
  });

  it("flags host-midnight", () => {
    const hits = scanBakuClockText(`d.setHours(0, 0, 0, 0);\n`);
    assert.equal(hits.some((h) => h.rule === "host-midnight"), true);
  });

  it("flags Dockerfile ENV TZ=", () => {
    const hits = scanBakuClockText(`FROM node:22\nENV TZ=Asia/Baku\n`);
    assert.equal(hits.some((h) => h.rule === "tz-env"), true);
  });

  it("does not flag TZ= in comments", () => {
    const hits = scanBakuClockText(`# ENV TZ=Asia/Baku\n`);
    assert.equal(hits.filter((h) => h.rule === "tz-env").length, 0);
  });

  it("flags compose TZ: Asia/Baku", () => {
    const hits = scanBakuClockText(`    TZ: Asia/Baku\n`);
    assert.equal(hits.some((h) => h.rule === "tz-env"), true);
  });

  it("respects baku-clock-allow on previous line", () => {
    const hits = scanBakuClockText(
      `// baku-clock-allow: utc-today legacy report stamp\nconst d = new Date().toISOString().slice(0, 10);\n`,
    );
    assert.equal(hits.length, 0);
  });

  it("skips kit baku.ts by relPath", () => {
    const hits = scanBakuClockText(
      `new Date().toISOString().slice(0, 10);\n`,
      "packages/satellite-kit/src/time/baku.ts",
    );
    assert.equal(hits.length, 0);
  });

  it("flags multiline utc-today", () => {
    const hits = scanBakuClockText(
      `const d = new Date()\n  .toISOString()\n  .slice(0, 10);\n`,
    );
    assert.equal(hits.some((h) => h.rule === "utc-today"), true);
  });

  it("does not flag TZ: UTC in CI yaml", () => {
    const hits = scanBakuClockText(`          TZ: UTC\n`);
    assert.equal(hits.filter((h) => h.rule === "tz-env").length, 0);
  });
});

describe("lint-baku-clock.mjs", () => {
  it("exits 0 with empty baseline", () => {
    const r = runLint([]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /No regressions vs baseline/);
  });

  it("ui barrel source does not import kit time", () => {
    const barrel = path.join(root, "packages/satellite-kit/src/ui/index.ts");
    const text = fs.readFileSync(barrel, "utf8");
    assert.equal(/satellite-kit\/time|time\/baku/.test(text), false);
  });

  it("--strict exits 0 when repo is clean", () => {
    const r = runLint(["--strict"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
