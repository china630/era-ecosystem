#!/usr/bin/env node
/**
 * Static DOC_DRIFT candidates: COVERAGE_MATRIX SHIPPED rows vs module-map + API routes.
 * Usage:
 *   node scripts/audit-layer-coverage.mjs
 *   node scripts/audit-layer-coverage.mjs --app era-clinic
 *   node scripts/audit-layer-coverage.mjs --json
 *
 * R1 Phase 7 helper — not CI-blocking.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COVERAGE_PATH = join(ROOT, "docs/COVERAGE_MATRIX.md");

const INTEGRATION_IDS = [
  "CLI-01",
  "CLI-MDM-01",
  "CLI-MDM-02",
  "CLI-WF-01",
  "HOT-MDM-01",
  "HOT-MDM-02",
  "FIN-HR-MDM-01",
  "FIN-CIT-01",
  "FIN-CP-MDM-01",
  "BANK-MDM-01",
  "ORCH-MDM-01",
  "ORCH-MDM-02",
  "ORCH-MDM-03",
];

function walkApiRoutes(appDir) {
  const apiRoot = join(appDir, "app/api");
  const routes = [];
  if (!existsSync(apiRoot)) return routes;
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "route.ts" || name === "route.tsx") {
        routes.push(p.replace(/\\/g, "/").replace(ROOT, "").replace(/^\//, ""));
      }
    }
  }
  walk(apiRoot);
  return routes;
}

function readModuleMap(app) {
  const rulesDir = join(ROOT, app, ".cursor/rules");
  if (!existsSync(rulesDir)) return "";
  let text = "";
  for (const f of readdirSync(rulesDir)) {
    if (f.endsWith("-module-map.mdc")) {
      text += readFileSync(join(rulesDir, f), "utf8") + "\n";
    }
  }
  return text;
}

function parseCoverageRows(content, filterIds) {
  const rows = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (line.includes("----")) continue;
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < 4) continue;
    const id = cols[1];
    if (!id || id === "ID") continue;
    if (filterIds && !filterIds.includes(id)) continue;
    const status = cols.find((c) => /SHIPPED|HEADLESS|API|STUB/.test(c)) ?? cols[cols.length - 2];
    if (!/SHIPPED|HEADLESS/.test(status)) continue;
    rows.push({
      id,
      capability: cols[2] ?? "",
      apiHint: cols[3] ?? "",
      uiHint: cols.slice(4).find((c) => c && c !== "—" && c !== "Y") ?? "",
      line,
    });
  }
  return rows;
}

function inferAppFromId(id) {
  if (id.startsWith("CLI-")) return "era-clinic";
  if (id.startsWith("HOT-")) return "era-hotel-pms";
  if (id.startsWith("FIN-")) return "era-finance-core";
  if (id.startsWith("BANK-")) return "era-bank";
  if (id.startsWith("ORCH-")) return "era-orchestrator";
  return null;
}

function checkRow(row, app) {
  const appDir = join(ROOT, app);
  const routes = walkApiRoutes(appDir);
  const moduleMap = readModuleMap(app);
  const hints = [row.id, row.capability, row.apiHint, row.uiHint]
    .join(" ")
    .toLowerCase();

  const apiTokens = [
    ...hints.match(/\/api\/[\w\-/[\]]+/g) ?? [],
    ...hints.match(/\/admin\/[\w\-/]+/g) ?? [],
  ];

  const missingFromModuleMap = [];
  const missingRoutes = [];

  for (const token of apiTokens) {
    const normalized = token.replace(/\[.*?\]/g, "");
    if (moduleMap && !moduleMap.includes(normalized) && !moduleMap.includes(token)) {
      missingFromModuleMap.push(normalized);
    }
    const routeFile = `${app}${normalized}/route.ts`.replace("//", "/");
    const alt = routes.find((r) => r.includes(normalized.replace(/^\//, "")));
    if (apiTokens.length && !alt && normalized.startsWith("/api")) {
      missingRoutes.push(normalized);
    }
  }

  const drift = [];
  if (missingFromModuleMap.length) {
    drift.push({
      code: "DOC_DRIFT",
      kind: "module-map",
      detail: `Route hints not in module-map: ${missingFromModuleMap.join(", ")}`,
    });
  }

  return {
    id: row.id,
    app,
    routeCount: routes.length,
    moduleMapPresent: Boolean(moduleMap),
    candidates: drift,
  };
}

function main() {
  const appFilter = process.argv.includes("--app")
    ? process.argv[process.argv.indexOf("--app") + 1]
    : null;
  const json = process.argv.includes("--json");
  const content = readFileSync(COVERAGE_PATH, "utf8");
  const rows = parseCoverageRows(content, INTEGRATION_IDS);
  const results = [];

  for (const row of rows) {
    const app = inferAppFromId(row.id);
    if (!app) continue;
    if (appFilter && app !== appFilter) continue;
    results.push(checkRow(row, app));
  }

  const drifts = results.filter((r) => r.candidates.length > 0);

  if (json) {
    console.log(JSON.stringify({ scanned: results.length, drifts, results }, null, 2));
  } else {
    console.log(`Layer coverage audit — ${results.length} SHIPPED integration row(s)\n`);
    for (const r of results) {
      const flag = r.candidates.length ? "REVIEW" : "OK";
      console.log(`  [${flag}] ${r.id} (${r.app}) routes=${r.routeCount} module-map=${r.moduleMapPresent}`);
      for (const c of r.candidates) {
        console.log(`         ${c.code}: ${c.detail}`);
      }
    }
    console.log(`\nDOC_DRIFT candidates: ${drifts.length} (human review required)`);
  }
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
