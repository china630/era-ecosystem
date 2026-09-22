#!/usr/bin/env node
/**
 * Asia/Baku clock antipattern lint (Wave 5).
 *
 * Usage:
 *   node scripts/lint-baku-clock.mjs
 *   node scripts/lint-baku-clock.mjs --strict
 *   node scripts/lint-baku-clock.mjs --update-baseline
 *   node scripts/lint-baku-clock.mjs --json
 *
 * Allow: same or previous line comment `baku-clock-allow: <rule> <reason>`
 * ADR: docs/adr/asia-baku-clock.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "scripts", "baselines", "baku-clock-baseline.json");

const updateBaseline = process.argv.includes("--update-baseline");
const strict = process.argv.includes("--strict");
const jsonOut = process.argv.includes("--json");

/** Skip while walking product source (not tz-env named files). */
const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "generated",
  "coverage",
  ".git",
  "prisma",
  "scripts",
  "__tests__",
  "tests",
]);

const SKIP_FILE_RE = /\.(spec|test)\.(ts|tsx|js|mjs|cjs)$/;
const SEED_FILE_RE = /(^|\/)seed[^/]*\.(ts|tsx|js|mjs|cjs)$/i;

/** Kit implementation is the canonical source — never lint itself. */
const SKIP_REL = new Set(["packages/satellite-kit/src/time/baku.ts"]);

const RULES = ["utc-today", "utc-today-offset", "locale-no-tz", "host-midnight", "tz-env"];

function buildScanRoots() {
  const roots = [
    "packages/satellite-kit/src",
    "era-finance-core/apps/web",
    "era-finance-core/apps/api/src",
    "era-orchestrator/apps/web",
    "era-orchestrator/apps/api/src",
    "era-data-hub/apps/api/src",
    "era-bank-core/apps",
    "era-bank-core/tools",
  ];
  for (const name of fs.readdirSync(root)) {
    if (!name.startsWith("era-")) continue;
    const abs = path.join(root, name);
    if (!fs.statSync(abs).isDirectory()) continue;
    if (name === "era-finance-core" || name === "era-orchestrator" || name === "era-data-hub" || name === "era-bank-core") {
      continue;
    }
    for (const sub of ["app", "src", "lib"]) {
      const p = path.join(abs, sub);
      if (fs.existsSync(p)) roots.push(`${name}/${sub}`);
    }
  }
  const extraDirs = [
    "era-finance-core/apps/extension",
    "era-finance-core/apps/web/app",
  ];
  for (const rel of extraDirs) {
    if (fs.existsSync(path.join(root, rel)) && !roots.includes(rel)) roots.push(rel);
  }
  return roots;
}

function collectTzEnvFiles() {
  const files = [];
  function pushIfFile(abs) {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) files.push(abs);
  }
  for (const name of ["docker-compose.yml", "docker-compose.prod.yml", ".env.example"]) {
    pushIfFile(path.join(root, name));
  }
  const ghWorkflows = path.join(root, ".github", "workflows");
  if (fs.existsSync(ghWorkflows)) {
    walkNamed(ghWorkflows, files, /\.ya?ml$/i, 2);
  }
  const dockerDir = path.join(root, "docker");
  if (fs.existsSync(dockerDir)) {
    walkNamed(dockerDir, files, /^(Dockerfile.*|.*entrypoint.*\.(sh|mjs)|docker-compose.*\.ya?ml)$/i);
  }
  for (const name of fs.readdirSync(root)) {
    if (!name.startsWith("era-")) continue;
    const abs = path.join(root, name);
    if (!fs.statSync(abs).isDirectory()) continue;
    pushIfFile(path.join(abs, "Dockerfile"));
    pushIfFile(path.join(abs, "docker-entrypoint.sh"));
    walkNamed(abs, files, /^(Dockerfile.*|docker-entrypoint\.sh|docker-compose.*\.ya?ml)$/i, 2);
  }
  return files;
}

function walkNamed(dir, acc, nameRe, maxDepth = 4, depth = 0) {
  if (depth > maxDepth || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const skip = new Set(["node_modules", ".next", "dist", "generated", "coverage", ".git"]);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    if (skip.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkNamed(abs, acc, nameRe, maxDepth, depth + 1);
      continue;
    }
    if (nameRe.test(ent.name)) acc.push(abs);
  }
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walk(abs, acc);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(ent.name)) continue;
    if (SKIP_FILE_RE.test(ent.name)) continue;
    if (SEED_FILE_RE.test(ent.name.replace(/\\/g, "/"))) continue;
    acc.push(abs);
  }
  return acc;
}

function lineNoAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function pushRegexHits(hits, text, lines, re, rule) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const lineNo = lineNoAt(text, m.index);
    const lineIdx = lineNo - 1;
    if (isAllowed(lines, lineIdx, rule)) continue;
    const already = hits.some((h) => h.rule === rule && h.line === lineNo);
    if (already) continue;
    hits.push({ rule, line: lineNo, snippet: (lines[lineIdx] ?? "").trim().slice(0, 140) });
  }
}

function allowOnLine(line, rule) {
  const m = line.match(/baku-clock-allow:\s*([\w-]+)/);
  if (!m) return false;
  return m[1] === rule || m[1] === "*";
}

function isAllowed(lines, index, rule) {
  if (allowOnLine(lines[index] ?? "", rule)) return true;
  if (index > 0 && allowOnLine(lines[index - 1] ?? "", rule)) return true;
  return false;
}

/** Extract call text starting at `openParenIndex` of a `(` after method name. */
function extractCall(text, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openParenIndex, i + 1);
    }
  }
  return text.slice(openParenIndex, Math.min(text.length, openParenIndex + 400));
}

/**
 * Scan file text; return hits `{ rule, line, snippet }`.
 * Exported for unit tests.
 */
export function scanBakuClockText(text, relPath = "") {
  const hits = [];
  if (SKIP_REL.has(relPath.replace(/\\/g, "/"))) return hits;

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // tz-env — runtime assignment / Docker ENV (not comments)
    const isComment = /^\s*(\/\/|#|--)/.test(line);
    if (
      !isComment &&
      (/process\.env\.TZ\s*=/.test(line) ||
        /\bENV\s+TZ=/.test(line) ||
        /\bTZ\s*[=:]\s*["']?Asia\/Baku\b/.test(line))
    ) {
      if (!/beforeAll|afterAll|describe\(|it\(/.test(line) && !isAllowed(lines, i, "tz-env")) {
        hits.push({ rule: "tz-env", line: lineNo, snippet: line.trim().slice(0, 140) });
      }
    }
  }

  pushRegexHits(
    hits,
    text,
    lines,
    /new\s+Date\s*\(\s*\)\s*\.toISOString\s*\(\s*\)\s*\.slice\s*\(\s*0\s*,\s*(?:10|7)\s*\)/g,
    "utc-today",
  );
  pushRegexHits(
    hits,
    text,
    lines,
    /new\s+Date\s*\(\s*Date\.now\s*\(\s*\)\s*[+\-]\s*[^)]+\)\s*\.toISOString\s*\(\s*\)\s*\.slice\s*\(\s*0\s*,\s*10\s*\)/g,
    "utc-today-offset",
  );
  pushRegexHits(hits, text, lines, /\.setHours\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/g, "host-midnight");

  // locale-no-tz — multi-line aware via whole-text scan of call sites
  const localeRe = /\.toLocale(?:String|DateString|TimeString)\s*\(/g;
  let m;
  while ((m = localeRe.exec(text)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const call = extractCall(text, openIdx);
    // number formatting: fraction digits options
    if (/maximumFractionDigits|minimumFractionDigits/.test(call)) continue;
    // already Baku or UTC civil
    if (/timeZone\s*:/.test(call)) continue;
    // bare locale-only number format: .toLocaleString("en-US") — not empty ()
    {
      const compact = call.replace(/\s+/g, "");
      if (/^\(["'][\w-]+["']\)$/.test(compact)) continue;
    }

    const lineNo = text.slice(0, m.index).split(/\r?\n/).length;
    const lineIdx = lineNo - 1;
    if (isAllowed(lines, lineIdx, "locale-no-tz")) continue;
    const snippet = (lines[lineIdx] ?? "").trim().slice(0, 140);
    hits.push({ rule: "locale-no-tz", line: lineNo, snippet });
  }

  return hits;
}

function hitKey(file, rule, line) {
  return `${file}|${rule}|${line}`;
}

function main() {
  const files = [];
  for (const relRoot of buildScanRoots()) {
    walk(path.join(root, relRoot), files);
  }
  for (const abs of collectTzEnvFiles()) {
    if (!files.includes(abs)) files.push(abs);
  }

  const details = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (SKIP_REL.has(rel)) continue;
    const text = fs.readFileSync(abs, "utf8");
    const violations = scanBakuClockText(text, rel);
    if (violations.length === 0) continue;
    details.push({ file: rel, violations });
  }

  const allHits = [];
  for (const d of details) {
    for (const v of d.violations) {
      allHits.push({ file: d.file, rule: v.rule, line: v.line, snippet: v.snippet });
    }
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totals: Object.fromEntries(RULES.map((r) => [r, allHits.filter((h) => h.rule === r).length])),
    hits: allHits.map((h) => ({ file: h.file, rule: h.rule, line: h.line })),
  };

  if (updateBaseline) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    const baseline = { version: 1, hits: report.hits };
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    console.log(`Updated baseline: ${path.relative(root, baselinePath)} (${report.hits.length} hits)`);
    console.log(JSON.stringify(report.totals, null, 2));
    process.exit(0);
  }

  let baseline = { version: 1, hits: [] };
  if (fs.existsSync(baselinePath)) {
    baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  }

  const baselineKeys = new Set(
    (baseline.hits ?? []).map((h) => hitKey(h.file, h.rule, h.line)),
  );
  const regressions = allHits.filter((h) => !baselineKeys.has(hitKey(h.file, h.rule, h.line)));

  if (jsonOut) {
    console.log(JSON.stringify({ report, baseline, regressions, details }, null, 2));
  } else {
    console.log("Asia/Baku clock lint\n");
    console.log("Totals:", report.totals);
    console.log(`Baseline hits: ${(baseline.hits ?? []).length}`);
    if (regressions.length) {
      console.log(`\nRegressions (${regressions.length}):`);
      for (const h of regressions.slice(0, 40)) {
        console.log(`  ${h.file}:${h.line} [${h.rule}] ${h.snippet}`);
      }
      if (regressions.length > 40) console.log(`  … +${regressions.length - 40} more`);
    } else {
      console.log("\nNo regressions vs baseline.");
    }
  }

  if (strict) {
    process.exit(allHits.length > 0 ? 1 : 0);
  }
  process.exit(regressions.length > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
