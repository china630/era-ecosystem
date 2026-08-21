#!/usr/bin/env node
/**
 * Local ship gates before git push / -PublishDev.
 * Not a substitute for GitHub CI or docker compose healthchecks.
 *
 *   node scripts/era-ship-prepush.mjs
 *   node scripts/era-ship-prepush.mjs --strict
 *   node scripts/era-ship-prepush.mjs --quality-only
 *   node scripts/era-ship-prepush.mjs --base origin/dev
 *
 * Skip (explicit only): ERA_SHIP_SKIP_GATES=1
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const strict = argv.includes("--strict");
const qualityOnly = argv.includes("--quality-only");
const baseIdx = argv.indexOf("--base");
const baseArg = baseIdx >= 0 ? argv[baseIdx + 1] : "";

if (process.env.ERA_SHIP_SKIP_GATES === "1") {
  console.warn("ERA_SHIP_SKIP_GATES=1 — skipping local ship gates.");
  process.exit(0);
}
if (process.env.ERA_SHIP_GATES_DONE === "1") {
  console.log("ERA_SHIP_GATES_DONE=1 — gates already ran in this ship session.");
  process.exit(0);
}

function run(label, cmd, args, cwd = root) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  if ((r.status ?? 1) !== 0) {
    console.error(`FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
}

function gitLines(args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) return [];
  return r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

function refExists(ref) {
  const r = spawnSync("git", ["rev-parse", "--verify", ref], { cwd: root, encoding: "utf8" });
  return r.status === 0;
}

function resolveBase() {
  if (baseArg) return baseArg;
  if (refExists("origin/dev")) return "origin/dev";
  if (refExists("origin/master")) return "origin/master";
  return "";
}

function collectFiles(base) {
  const set = new Set();
  const specs = [];
  if (base) specs.push(["diff", "--name-only", `${base}...HEAD`]);
  specs.push(["diff", "--name-only"], ["diff", "--cached", "--name-only"]);
  for (const args of specs) {
    for (const f of gitLines(args)) set.add(f);
  }
  return [...set];
}

const SATELLITE_DIRS = [
  "era-hotel-pms",
  "era-fnb-pos",
  "era-clinic",
  "era-retail-pos",
  "era-logistics",
  "era-construction",
  "era-crm",
  "era-auto-service",
  "era-wholesale",
  "era-bank",
  "era-bank-dbo",
];

const PKG_ORDER = [
  "era-contracts",
  "clinic-domain",
  "i18n-common",
  "era-storage",
  "era-fiscal",
  "satellite-kit",
];

function hasPrefix(files, prefix) {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return files.some((f) => f === prefix || f.startsWith(p));
}

function rebuildDirtyPackages(files) {
  const dirtyIdx = PKG_ORDER.findIndex((dir) => hasPrefix(files, `packages/${dir}`));
  if (dirtyIdx < 0) return;
  const toBuild = PKG_ORDER.slice(dirtyIdx);
  for (const dir of toBuild) {
    const pkgDir = path.join(root, "packages", dir);
    if (!fs.existsSync(path.join(pkgDir, "package.json"))) continue;
    const hasNm = fs.existsSync(path.join(pkgDir, "node_modules"));
    if (!hasNm) run(`npm ci packages/${dir}`, "npm", ["ci"], pkgDir);
    run(`build packages/${dir}`, "npm", ["run", "build"], pkgDir);
  }
}

function runSatellite(dir) {
  const cwd = path.join(root, dir);
  if (!fs.existsSync(path.join(cwd, "package.json"))) {
    console.warn(`skip ${dir}: no package.json`);
    return;
  }
  if (fs.existsSync(path.join(cwd, "prisma", "schema.prisma"))) {
    run(`${dir} prisma generate`, "npx", ["prisma", "generate"], cwd);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
  if (pkg.scripts?.test) run(`${dir} test`, "npm", ["test"], cwd);
  if (pkg.scripts?.build) run(`${dir} build`, "npm", ["run", "build"], cwd);
}

console.log("ERA ship pre-push (local gates — not full GitHub CI)\n");

run(
  "quality-gates",
  "npm",
  ["run", strict ? "run:quality-gates:strict" : "run:quality-gates"],
  root,
);

if (qualityOnly) {
  console.log("\nPASS — quality gates (--quality-only, no scoped app tests)");
  process.exit(0);
}

const base = resolveBase();
const files = collectFiles(base);
console.log(`\nDiff base: ${base || "(working tree only)"}`);
console.log(`Changed files: ${files.length}`);

rebuildDirtyPackages(files);

if (hasPrefix(files, "era-finance-core")) {
  const cwd = path.join(root, "era-finance-core");
  run("finance NAS literals", "npm", ["run", "validate:no-nas-literals"], cwd);
  run(
    "finance integration tests",
    "npm",
    ["run", "test:integration", "-w", "@erafinance/api", "--", "--ci"],
    cwd,
  );
}

if (hasPrefix(files, "era-orchestrator")) {
  const cwd = path.join(root, "era-orchestrator");
  run("orchestrator prisma generate", "npm", ["run", "db:generate"], cwd);
  run("orchestrator test:api", "npm", ["run", "test:api"], cwd);
}

if (hasPrefix(files, "era-data-hub")) {
  const cwd = path.join(root, "era-data-hub");
  run("data-hub tests", "npm", ["run", "test", "-w", "@era/data-hub-api"], cwd);
}

if (hasPrefix(files, "era-bank-core")) {
  const cwd = path.join(root, "era-bank-core");
  run("bank-core test", "npm", ["test", "--", "--ci"], cwd);
  run("bank-core build", "npm", ["run", "build"], cwd);
}

for (const dir of SATELLITE_DIRS) {
  if (hasPrefix(files, dir)) runSatellite(dir);
}

console.log("\nPASS — local ship gates");
process.exit(0);
