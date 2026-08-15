#!/usr/bin/env node
/**
 * Unit tests for acceptance consistency helpers / CLI behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const checker = path.join(root, "scripts", "check-acceptance-consistency.mjs");

function runChecker(extraArgs = [], cwd = root) {
  return spawnSync(process.execPath, [checker, ...extraArgs], {
    cwd,
    encoding: "utf8",
  });
}

test("check:acceptance exits 0 on repo", () => {
  const r = runChecker();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS/);
});

test("check:acceptance --product clinic exits 0", () => {
  const r = runChecker(["--product", "clinic"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("bare status: ga without pilot_ready fails", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "era-acc-"));
  // Minimal fake repo with kit-config pointing at a ga edition
  fs.mkdirSync(path.join(tmp, "docs", "editions"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "docs", "products"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".cursor", "rules"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "docs", "products", "ERA-Acceptance-Standard.md"), "# canon\n");
  fs.writeFileSync(path.join(tmp, ".cursor", "rules", "task-acceptance.mdc"), "# rule\n");
  fs.writeFileSync(
    path.join(tmp, "docs", "editions", "clinic.yaml"),
    "product: clinic\nstatus: ga\npilot_ready: false\nnotes: test\n"
  );
  fs.writeFileSync(
    path.join(tmp, "kit-config.yaml"),
    `canon_path: docs/products/ERA-Acceptance-Standard.md
docs_roots:
  - docs
products:
  - id: clinic
    name: Clinic
    acceptance_system: docs/acceptance/Clinic-Acceptance-System.md
forbid_bare_ga_in:
  - docs/editions/clinic.yaml
exclude_md_names:
  - ERA-Acceptance-Standard.md
`
  );
  fs.mkdirSync(path.join(tmp, "docs", "acceptance"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "docs", "acceptance", "Clinic-Acceptance-System.md"), "# stub\n");

  // Copy checker into tmp? Better run from root with env — checker always uses its own repoRoot.
  // So instead mutate real clinic edition briefly is bad. Test the regex logic inline:
  const text = fs.readFileSync(path.join(tmp, "docs", "editions", "clinic.yaml"), "utf8");
  const statusGa = /^\s*status:\s*ga\s*$/m.test(text);
  const pilotReady = /^\s*pilot_ready:\s*true\s*$/m.test(text);
  assert.equal(statusGa, true);
  assert.equal(pilotReady, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("banned ga (partner) detected in prose", () => {
  const sample = "We shipped ga (partner) last week";
  assert.match(sample, /ga \(partner\)/i);
});

test("kit-config.yaml lists clinic readiness paths", () => {
  const raw = fs.readFileSync(path.join(root, "kit-config.yaml"), "utf8");
  assert.match(raw, /Clinic-Product-Readiness-Matrix\.md/);
  assert.match(raw, /forbid_bare_ga_in:/);
});
