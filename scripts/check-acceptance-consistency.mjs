#!/usr/bin/env node
/**
 * ERA Acceptance consistency gate.
 * Canon: docs/products/ERA-Acceptance-Standard.md
 * Config: kit-config.yaml (repo root)
 *
 * Usage:
 *   node scripts/check-acceptance-consistency.mjs
 *   node scripts/check-acceptance-consistency.mjs --strict
 *   node scripts/check-acceptance-consistency.mjs --product clinic
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const productIdx = args.indexOf("--product");
const productFilter =
  productIdx >= 0 && args[productIdx + 1] ? String(args[productIdx + 1]).toLowerCase() : "";

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
  console.error("FAIL:", msg);
}

function warn(msg) {
  warnings.push(msg);
  console.warn("WARN:", msg);
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

/** Minimal YAML subset reader for kit-config */
function loadKitConfig() {
  const candidates = [
    path.join(repoRoot, "kit-config.yaml"),
    path.join(repoRoot, "acceptance-kit", "kit-config.yaml"),
  ];
  const cfgPath = candidates.find((c) => fs.existsSync(c));
  if (!cfgPath) {
    fail("missing kit-config.yaml");
    return null;
  }
  const raw = readText(cfgPath);
  console.log("Loaded kit-config:", path.relative(repoRoot, cfgPath));

  const required = new Set();
  const forbid = [];
  const exclude = new Set([
    "ERA-Acceptance-Standard.md",
    "Product-Acceptance-Standard.md",
    "Acceptance-Honesty-Audit.md",
  ]);
  const docsRoots = [];

  const canon = raw.match(/^\s*canon_path:\s*(.+)\s*$/m);
  if (canon) required.add(canon[1].trim().replace(/^["']|["']$/g, "").replace(/\//g, path.sep));

  const products = [];
  let current = null;
  let mode = null;

  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*products:\s*$/.test(line)) {
      mode = "products";
      continue;
    }
    if (/^\s*forbid_bare_ga_in:\s*$/.test(line)) {
      mode = "forbid";
      continue;
    }
    if (/^\s*exclude_md_names:\s*$/.test(line)) {
      mode = "exclude";
      continue;
    }
    if (/^\s*docs_roots:\s*$/.test(line)) {
      mode = "docs";
      continue;
    }
    if (/^\S/.test(line) && !/^\s/.test(line)) {
      if (current) products.push(current);
      current = null;
      if (!/^(canon_path|docs_roots|products|forbid_bare_ga_in|exclude_md_names):/.test(line)) {
        mode = null;
      }
    }

    if (mode === "products") {
      const id = line.match(/^\s*-\s+id:\s*(.+)\s*$/);
      if (id) {
        if (current) products.push(current);
        current = { id: id[1].trim() };
        continue;
      }
      if (current) {
        const m = line.match(
          /^\s*(name|acceptance_system|readiness_matrix|implementation_matrix|evidence_rules):\s*(.+)\s*$/
        );
        if (m) current[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } else if (mode === "forbid") {
      const m = line.match(/^\s*-\s+(.+)\s*$/);
      if (m) forbid.push(m[1].trim().replace(/^["']|["']$/g, ""));
    } else if (mode === "exclude") {
      const m = line.match(/^\s*-\s+(.+)\s*$/);
      if (m) exclude.add(m[1].trim().replace(/^["']|["']$/g, ""));
    } else if (mode === "docs") {
      const m = line.match(/^\s*-\s+(.+)\s*$/);
      if (m) docsRoots.push(m[1].trim().replace(/^["']|["']$/g, ""));
    }
  }
  if (current) products.push(current);

  required.add(path.join(".cursor", "rules", "task-acceptance.mdc"));
  required.add(path.join("docs", "acceptance", "UI-COVERAGE-BOARD.md"));

  for (const p of products) {
    if (productFilter && p.id !== productFilter) continue;
    for (const key of [
      "acceptance_system",
      "readiness_matrix",
      "implementation_matrix",
      "evidence_rules",
    ]) {
      if (p[key]) required.add(p[key].replace(/\//g, path.sep));
    }
  }

  return {
    required: [...required],
    forbid,
    exclude,
    docsRoots: docsRoots.length ? docsRoots : ["docs", "reports"],
    products,
    cfgPath,
  };
}

function walkMdFiles(relRoot, excludeNames, out) {
  const abs = path.join(repoRoot, relRoot);
  if (!fs.existsSync(abs)) return;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, ent.name);
    if (ent.isDirectory()) {
      walkMdFiles(path.relative(repoRoot, full), excludeNames, out);
      continue;
    }
    if (!ent.name.endsWith(".md")) continue;
    if (excludeNames.has(ent.name)) continue;
    out.push(full);
  }
}

function lineAllowsBanContext(line) {
  return /Forbidden|Banned|does not claim|do not claim|do\s*\*{0,2}\s*not|must not|≠|never|запрет|while yaml|No `ga`|not claimed|still \*{0,2}not\*{0,2}|still open|Honesty|required before|before AC-|before HOT-06| \|\s*\*\*Open\*\*|in BE rollup|Scaffold BE \*\*🟡|Still open|do not claim ready|claim HOT-06|host compose|host apply|field TENANT|field HOT-06/i.test(
    line,
  );
}

function isHot06FalseShippedClaim(line) {
  if (!/HOT-06/i.test(line) || !/SHIPPED/i.test(line)) return false;
  if (lineAllowsBanContext(line)) return false;
  if (
    /not\s+\*{0,2}SHIPPED|Not SHIPPED|HEADLESS|before SHIPPED|still HEADLESS|remain open|field open|field SPA|field UAT|field residual|field section|field runbook|Open\s*\(field|pool sell still open|false HOT-06/i.test(
      line,
    )
  ) {
    return false;
  }
  return true;
}

function isTenantTopoFalseScaffoldClaim(line) {
  if (
    !/\b(AC-HOT-TENANT|AC-CLI-TENANT|AC-CP-TOPO)\b/.test(line) ||
    !/Scaffold\s*✅/.test(line)
  ) {
    return false;
  }
  if (lineAllowsBanContext(line)) return false;
  if (
    /still not|needs field|remain open|not Scaffold|≠\s*Scaffold|until |out of BE|Excluded|later TOPO|not mark|stay[s]? 🟡|stays 🟡| \|\s*\*\*Open\*\*/i.test(
      line,
    )
  ) {
    return false;
  }
  return true;
}

function checkBannedProse(cfg) {
  const check = "\u2705";
  const banned = [
    { name: "all-checkmark-bold", pattern: new RegExp(`Scaffold AC \\*\\*all ${check}\\*\\*`) },
    { name: "matrix-all-checkmark", pattern: new RegExp(`Matrix \\*\\*all ${check}\\*\\*`) },
    {
      name: "all-scaffold-green",
      pattern: new RegExp(`all Scaffold ${check}|Scaffold AC all green|PRD AC all ${check}`, "i"),
    },
    { name: "ga-partner", pattern: /ga \(partner\)/i },
    { name: "ga-greenfield", pattern: /ga \(greenfield\)/i },
    { name: "matrix-all-green", pattern: /Matrix all (green|✅)/i },
    // Claim form only — not the phrase "product readiness"
    { name: "product-ready-claim", pattern: /\bproduct ready\b(?!ness)/i },
    // SaaS Wave 12 honesty
    {
      name: "saas-pool-ready-claim",
      pattern: /SaaS pool ready|SHARED pool ready|sellable SHARED pool/i,
    },
  ];

  const files = [];
  for (const root of cfg.docsRoots) walkMdFiles(root, cfg.exclude, files);

  for (const full of files) {
    const text = readText(full);
    const rel = path.relative(repoRoot, full);
    for (const b of banned) {
      if (b.name === "product-ready-claim" && !strict) continue;
      if (
        b.name === "product-ready-claim" &&
        (/Acceptance-Standard|acceptance[/\\]README|Honesty-Audit|SaaS-Honesty/i.test(rel) ||
          /Forbidden:|do not|must not|≠|!=/i.test(text))
      ) {
        // Still scan line-by-line for positive claims outside forbid context
        const lines = text.split(/\r?\n/);
        let hit = false;
        for (const line of lines) {
          if (!b.pattern.test(line)) continue;
          if (lineAllowsBanContext(line)) continue;
          hit = true;
          break;
        }
        if (hit) fail(`${b.name} in ${rel}`);
        continue;
      }
      // Line-aware: allow documenting the ban itself
      const lines = text.split(/\r?\n/);
      let hit = false;
      for (const line of lines) {
        if (!b.pattern.test(line)) continue;
        if (lineAllowsBanContext(line)) continue;
        if (
          b.name === "saas-pool-ready-claim" &&
          (/SaaS-Honesty-Closeout\.md$/i.test(rel) ||
            /Honesty-Closeout|do not mark|from this (ADR|document)|Forbidden|Claim freeze|positive claims/i.test(
              line,
            ))
        ) {
          continue;
        }
        hit = true;
        break;
      }
      if (hit) fail(`${b.name} in ${rel}`);
    }

    // SaaS Wave 12: HOT-06 / TENANT / TOPO false-green (line-aware)
    const lines = text.split(/\r?\n/);
    const isHonestyCanon = /SaaS-Honesty-Closeout\.md$/i.test(rel);
    for (const line of lines) {
      if (!isHonestyCanon && isHot06FalseShippedClaim(line)) {
        fail(`hot06-shipped-claim in ${rel}: ${line.trim().slice(0, 120)}`);
      }
      if (!isHonestyCanon && isTenantTopoFalseScaffoldClaim(line)) {
        fail(`tenant-topo-scaffold-claim in ${rel}: ${line.trim().slice(0, 120)}`);
      }
    }

    if (strict && /\ball\s+✅\b/i.test(text) && !/forbidden|do not|never|не /i.test(text)) {
      if (/Matrix|Scaffold|AC rollup|product/i.test(text)) {
        warn(`possible all-✅ status claim in ${rel}`);
      }
    }
  }
}

function checkBareGa(cfg) {
  for (const yamlRel of cfg.forbid) {
    const yp = path.join(repoRoot, yamlRel.replace(/\//g, path.sep));
    if (!fs.existsSync(yp)) {
      fail(`missing edition yaml: ${yamlRel}`);
      continue;
    }
    const text = readText(yp);
    const statusGa = /^\s*status:\s*ga\s*$/m.test(text);
    const pilotReady = /^\s*pilot_ready:\s*true\s*$/m.test(text);
    if (statusGa && !pilotReady) {
      fail(`${yamlRel} has status: ga without pilot_ready: true`);
    }
  }
}

function checkRequired(cfg) {
  for (const r of cfg.required) {
    const norm = r.replace(/\//g, path.sep);
    if (!exists(norm)) fail(`missing required SSOT: ${norm}`);
  }
}

/** Strict: edition ga requires Pilot field [x] in matching Product-Readiness */
function checkEditionVsReadiness(cfg) {
  if (!strict) return;
  for (const p of cfg.products) {
    if (productFilter && p.id !== productFilter) continue;
    if (!p.readiness_matrix) continue;
    const yamlRel = `docs/editions/${p.id}.yaml`;
    const yp = path.join(repoRoot, yamlRel);
    if (!fs.existsSync(yp)) continue;
    const y = readText(yp);
    if (!/^\s*status:\s*ga\s*$/m.test(y)) continue;
    const rmPath = path.join(repoRoot, p.readiness_matrix.replace(/\//g, path.sep));
    if (!fs.existsSync(rmPath)) continue;
    const rm = readText(rmPath);
    // Look for Pilot field column value [x] in summary table row
    if (!/\|\s*\*\*[^*]+\*\*\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*\[x\]\s*\|/m.test(rm)) {
      // simpler: require literal Pilot field [x] somewhere near field
      if (!/Pilot field[\s\S]{0,200}\[x\]/i.test(rm) && !/\|\s*\[x\]\s*\|\s*`ga`/i.test(rm)) {
        fail(`${yamlRel} is ga but ${p.readiness_matrix} lacks Pilot field [x]`);
      }
    }
  }
}

/** Strict: Product-Readiness Sell must not claim GA when layers are yellow/red */
function checkReadinessSellHonesty(cfg) {
  if (!strict) return;
  for (const p of cfg.products) {
    if (productFilter && p.id !== productFilter) continue;
    if (!p.readiness_matrix) continue;
    const rmPath = path.join(repoRoot, p.readiness_matrix.replace(/\//g, path.sep));
    if (!fs.existsSync(rmPath)) continue;
    const rm = readText(rmPath);
    const sellGa = /Sell\s*\/\s*show[\s\S]{0,800}\b(claim GA|product GA|\bGA\b(?! —))/i.test(rm);
    // Our templates say "do not claim GA" — that's fine. Fail only positive GA sell.
    if (/\|\s*[^*|\n]*\|\s*`ga`\s*\|\s*(ready|GA|sell)\s*\|/i.test(rm)) {
      fail(`${p.readiness_matrix}: Sell/show claims GA while edition column may be inconsistent`);
    }
    if (sellGa && /do not claim GA/i.test(rm) === false && /\bclaim GA\b/i.test(rm)) {
      fail(`${p.readiness_matrix}: positive GA sell claim`);
    }
  }
}

/** Strict: SHIPPED rows in COVERAGE should not have both OpsUI and SatAdmin as N when Doc implies UI */
function checkCoverageShipped(cfg) {
  if (!strict) return;
  const covPath = path.join(repoRoot, "docs", "COVERAGE_MATRIX.md");
  if (!fs.existsSync(covPath)) {
    fail("missing docs/COVERAGE_MATRIX.md");
    return;
  }
  const lines = readText(covPath).split(/\r?\n/);
  for (const line of lines) {
    if (!/^\|/.test(line) || !/\|\s*SHIPPED\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    // Expected: | ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | Status | Blocker |
    if (cells.length < 10) continue;
    const id = cells[1];
    const ops = cells[5];
    const sat = cells[6];
    const org = cells[7];
    const superA = cells[8];
    const status = cells[9];
    if (status !== "SHIPPED") continue;
    // Skip HEADLESS-like: all actor UI are — 
    const actors = [ops, sat, org, superA];
    const hasY = actors.some((a) => a === "Y" || /^Y\b/.test(a));
    const allDash = actors.every((a) => a === "—" || a === "-" || a === "");
    if (!hasY && !allDash) {
      // has N somewhere without Y
      if (actors.some((a) => a === "N")) {
        fail(`COVERAGE ${id}: SHIPPED but actor UI has N and no Y`);
      }
    }
    // UAT mention heuristic in Blocker/notes cell
    const notes = cells.slice(10).join(" ");
    if (
      hasY &&
      !/UAT|smoke|reports\//i.test(notes) &&
      !/HEADLESS|cron|worker/i.test(id + notes)
    ) {
      warn(`COVERAGE ${id}: SHIPPED with UI but Blocker/notes lack UAT/reports mention`);
    }
  }
}

/** Derived UI board must exist; each Product-Readiness must link it. */
function checkUiCoverageBoard(cfg) {
  const boardRel = path.join("docs", "acceptance", "UI-COVERAGE-BOARD.md");
  const boardAbs = path.join(repoRoot, boardRel);
  if (!fs.existsSync(boardAbs)) {
    fail("missing docs/acceptance/UI-COVERAGE-BOARD.md");
    return;
  }
  const board = readText(boardAbs);
  if (!/## 1\. Product rollup/.test(board) || !/## 2\. Work queue/.test(board)) {
    fail("UI-COVERAGE-BOARD.md must keep ## 1. Product rollup and ## 2. Work queue");
  }
  for (const token of ["NONE", "SCREEN", "SHOW", "PARTIAL", "HEADLESS", "VENDOR"]) {
    if (!board.includes(token)) {
      fail(`UI-COVERAGE-BOARD.md missing class token ${token}`);
    }
  }
  for (const p of cfg.products) {
    if (productFilter && p.id !== productFilter) continue;
    if (!p.readiness_matrix) continue;
    const rp = path.join(repoRoot, p.readiness_matrix.replace(/\//g, path.sep));
    if (!fs.existsSync(rp)) continue;
    if (!/UI-COVERAGE-BOARD\.md/.test(readText(rp))) {
      fail(`${p.readiness_matrix} must link UI-COVERAGE-BOARD.md`);
    }
  }
}

function checkSellProseVsEditions() {
  // Bank docs often say Ops UX GA — warn in strict
  if (!strict) return;
  const bankReadiness = path.join(
    repoRoot,
    "docs",
    "READINESS_MATRIX.md"
  );
  if (fs.existsSync(bankReadiness)) {
    const t = readText(bankReadiness);
    if (/\*\*GA\*\*/.test(t) && /Bank Ops UX GA/i.test(t)) {
      warn(
        "READINESS_MATRIX Bank Ops UX GA prose — prefer ops-mvp; edition SSOT is docs/editions/bank.yaml"
      );
    }
  }
}

function main() {
  console.log(
    `Acceptance consistency check — ${repoRoot}${strict ? " [strict]" : ""}${
      productFilter ? ` [product=${productFilter}]` : ""
    }`
  );
  const cfg = loadKitConfig();
  if (!cfg) {
    process.exit(1);
  }

  checkRequired(cfg);
  checkBannedProse(cfg);
  checkBareGa(cfg);
  checkEditionVsReadiness(cfg);
  checkReadinessSellHonesty(cfg);
  checkCoverageShipped(cfg);
  checkUiCoverageBoard(cfg);
  checkSellProseVsEditions();

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s).`);
  }
  if (failures.length) {
    console.error(`\n${failures.length} acceptance consistency failure(s).`);
    process.exit(1);
  }
  console.log("PASS - no banned false-green / false-ga prose; SSOT files present.");
  process.exit(0);
}

main();
