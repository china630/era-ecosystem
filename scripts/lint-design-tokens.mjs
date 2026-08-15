#!/usr/bin/env node
/**
 * DESIGN.md token lint — baseline mode (fail only on regression).
 *
 * Usage:
 *   node scripts/lint-design-tokens.mjs
 *   node scripts/lint-design-tokens.mjs --update-baseline
 *   node scripts/lint-design-tokens.mjs --strict
 *   node scripts/lint-design-tokens.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "scripts", "baselines", "design-token-baseline.json");

const updateBaseline = process.argv.includes("--update-baseline");
const strict = process.argv.includes("--strict");
const jsonOut = process.argv.includes("--json");

const SCAN_ROOTS = [
  "packages/satellite-kit/src",
  "era-finance-core/apps/web",
  ...fs
    .readdirSync(root)
    .filter((n) => n.startsWith("era-") && fs.statSync(path.join(root, n)).isDirectory())
    .map((n) => `${n}/src`),
];

const EXCLUDE_DIR = new Set(["node_modules", ".next", "dist", "coverage", "__tests__"]);
const EXCLUDE_FILE = /\.(spec|test)\.(tsx|jsx)$/;

const TOKEN_CLASS_RE =
  /MODAL_INPUT_CLASS|FORM_INPUT_CLASS|FORM_TEXTAREA_CLASS|MODAL_TEXTAREA_CLASS|MODAL_CHECKBOX_CLASS|<Field[\s>]|<FieldSelect[\s>]|<FieldTextarea[\s>]|<DatePicker[\s>]/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!EXCLUDE_DIR.has(name)) walk(full, acc);
    } else if (/\.(tsx|jsx)$/.test(name) && !EXCLUDE_FILE.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

function appKey(relPath) {
  const parts = relPath.replace(/\\/g, "/").split("/");
  if (parts[0] === "packages") return parts.slice(0, 2).join("/");
  if (parts[0]?.startsWith("era-")) return parts[0];
  return "other";
}

function scanFile(text) {
  const violations = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/rounded-\[2px\]|rounded-none/.test(line) && /input|select|textarea|button|Button/i.test(line)) {
      violations.push({ rule: "forbidden-radius", line: lineNo, snippet: line.trim().slice(0, 120) });
    }

    if (/<(input|select|textarea)\b/i.test(line) && /\bh-(10|11|12)\b/.test(line)) {
      violations.push({ rule: "forbidden-input-height", line: lineNo, snippet: line.trim().slice(0, 120) });
    }

    if (/<(input|select|textarea)\b/i.test(line) && !TOKEN_CLASS_RE.test(line)) {
      const ctxStart = Math.max(0, i - 2);
      const ctxEnd = Math.min(lines.length, i + 3);
      const ctx = lines.slice(ctxStart, ctxEnd).join("\n");
      if (!TOKEN_CLASS_RE.test(ctx)) {
        violations.push({ rule: "raw-input-no-token", line: lineNo, snippet: line.trim().slice(0, 120) });
      }
    }
  }

  return violations;
}

function emptyCounts() {
  return { "forbidden-radius": 0, "forbidden-input-height": 0, "raw-input-no-token": 0 };
}

function addCounts(target, violations) {
  for (const v of violations) {
    target[v.rule] = (target[v.rule] ?? 0) + 1;
  }
}

const files = [];
for (const relRoot of SCAN_ROOTS) {
  walk(path.join(root, relRoot), files);
}

const byApp = {};
const totals = emptyCounts();
const details = [];

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const text = fs.readFileSync(file, "utf8");
  const violations = scanFile(text);
  if (violations.length === 0) continue;

  const app = appKey(rel);
  if (!byApp[app]) byApp[app] = { ...emptyCounts(), files: 0 };
  byApp[app].files += 1;
  addCounts(byApp[app], violations);
  addCounts(totals, violations);
  details.push({ file: rel, violations });
}

const report = {
  generatedAt: new Date().toISOString(),
  totals,
  byApp: Object.fromEntries(
    Object.entries(byApp).map(([k, v]) => [k, { "forbidden-radius": v["forbidden-radius"], "forbidden-input-height": v["forbidden-input-height"], "raw-input-no-token": v["raw-input-no-token"], files: v.files }]),
  ),
};

if (updateBaseline) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Updated baseline: ${path.relative(root, baselinePath)}`);
  console.log(JSON.stringify(report.totals, null, 2));
  process.exit(0);
}

let baseline = null;
if (fs.existsSync(baselinePath)) {
  baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
} else if (!strict) {
  console.warn("No baseline file — run with --update-baseline to create one.");
}

const regressions = [];
if (baseline) {
  for (const rule of Object.keys(totals)) {
    const current = totals[rule] ?? 0;
    const base = baseline.totals?.[rule] ?? 0;
    if (current > base) {
      regressions.push({ rule, baseline: base, current, delta: current - base });
    }
  }
}

if (jsonOut) {
  console.log(JSON.stringify({ report, baseline, regressions, details }, null, 2));
} else {
  console.log("DESIGN token lint\n");
  console.log("Totals:", totals);
  if (baseline) console.log("Baseline:", baseline.totals);
  if (regressions.length) {
    console.log("\nRegressions:");
    for (const r of regressions) {
      console.log(`  ${r.rule}: ${r.baseline} → ${r.current} (+${r.delta})`);
    }
  } else if (baseline) {
    console.log("\nNo regressions vs baseline.");
  }
  if (strict && (totals["forbidden-radius"] + totals["forbidden-input-height"] + totals["raw-input-no-token"]) > 0) {
    console.log("\nStrict mode: violations present.");
  }
}

if (strict) {
  const totalViolations = Object.values(totals).reduce((a, b) => a + b, 0);
  process.exit(totalViolations > 0 ? 1 : 0);
}

process.exit(regressions.length > 0 ? 1 : 0);
