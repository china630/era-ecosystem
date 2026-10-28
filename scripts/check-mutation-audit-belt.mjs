#!/usr/bin/env node
/**
 * Fail-closed Layer A belt (Wave A):
 * 1) Each industry satellite api-utils hooks schedule*HttpMutationAudit from jsonOk.
 * 2) Mutation route.ts (POST/PATCH/PUT/DELETE) must not return a success JSON body
 *    via NextResponse.json / Response.json without also using jsonOk(...) or
 *    schedule*HttpMutationAudit(...) or an explicit `// audit-exempt: …` reason.
 *
 * See docs/adr/era-mutation-audit-standard.md · .cursor/plans/mutation-audit-depth.plan.md
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const apps = [
  {
    name: "era-hotel-pms",
    apiRoot: "era-hotel-pms/app/api",
    apiUtils: "era-hotel-pms/src/lib/api-utils.ts",
    needle: "scheduleHotelHttpMutationAudit",
    scheduleRe: /scheduleHotelHttpMutationAudit\s*\(/,
  },
  {
    name: "era-fnb-pos",
    apiRoot: "era-fnb-pos/app/api",
    apiUtils: "era-fnb-pos/src/lib/api-utils.ts",
    needle: "scheduleFnbHttpMutationAudit",
    scheduleRe: /scheduleFnbHttpMutationAudit\s*\(/,
  },
  {
    name: "era-clinic",
    apiRoot: "era-clinic/app/api",
    apiUtils: "era-clinic/src/lib/api-utils.ts",
    needle: "scheduleClinicHttpMutationAudit",
    scheduleRe: /scheduleClinicHttpMutationAudit\s*\(/,
  },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === "route.ts") out.push(p);
  }
  return out;
}

const MUT = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/;
const JSON_OK = /\bjsonOk\s*\(/;
const EXEMPT = /\/\/\s*audit-exempt:/;
/** Direct `return …json(` or assign-then-cookie (`const res = …json(`). */
const SUCCESS_JSON =
  /(?:return\s+(?:NextResponse|Response)\.json\s*\(|(?:const|let)\s+\w+\s*=\s*(?:NextResponse|Response)\.json\s*\()([\s\S]*?)\);/g;

function isErrorishArgs(args) {
  if (/status\s*:\s*[45]\d\d/.test(args)) return true;
  if (/status\s*:\s*err\./.test(args)) return true;
  if (/\berror\s*:/.test(args) && !/status\s*:\s*20\d/.test(args)) return true;
  const tail = args.split(",").slice(1).join(",");
  if (/[45]\d\d/.test(tail) && !/20\d/.test(tail)) return true;
  // dynamic status object without literal 2xx — treat as non-success for scanner
  if (/status\s*:/.test(args) && !/status\s*:\s*20\d/.test(args)) return true;
  return false;
}

function countSuspiciousSuccessJson(text) {
  let sus = 0;
  for (const m of text.matchAll(SUCCESS_JSON)) {
    if (isErrorishArgs(m[1])) continue;
    sus++;
  }
  return sus;
}

let failed = false;

for (const app of apps) {
  const utilsPath = path.join(root, app.apiUtils);
  if (!fs.existsSync(utilsPath)) {
    console.error(`FAIL ${app.name}: missing ${app.apiUtils}`);
    failed = true;
    continue;
  }
  const utilsText = fs.readFileSync(utilsPath, "utf8");
  if (!utilsText.includes(app.needle)) {
    console.error(`FAIL ${app.name}: ${app.apiUtils} missing ${app.needle}`);
    failed = true;
  } else {
    console.log(`OK ${app.name}: Layer A hook present`);
  }

  const bypass = [];
  for (const file of walk(path.join(root, app.apiRoot))) {
    const text = fs.readFileSync(file, "utf8");
    if (!MUT.test(text)) continue;
    if (EXEMPT.test(text)) continue;
    const hasJsonOk = JSON_OK.test(text);
    const hasSchedule = app.scheduleRe.test(text);
    if (hasJsonOk || hasSchedule) {
      const sus = countSuspiciousSuccessJson(text);
      // Raw success NextResponse/Response.json alongside jsonOk = residual silent path
      // (schedule alone is OK — CORS/cookie responses).
      if (sus > 0 && hasJsonOk) {
        bypass.push(
          path.relative(root, file) + ` (mixed success NextResponse.json ×${sus})`,
        );
      }
      continue;
    }
    if (countSuspiciousSuccessJson(text) > 0) {
      bypass.push(path.relative(root, file));
    }
  }

  if (bypass.length) {
    failed = true;
    console.error(`FAIL ${app.name}: silent Layer A bypass (${bypass.length}):`);
    for (const f of bypass.slice(0, 40)) console.error(`  - ${f}`);
    if (bypass.length > 40) console.error(`  … +${bypass.length - 40} more`);
  } else {
    console.log(`OK ${app.name}: no silent mutation success bypass`);
  }
}

if (failed) {
  console.error(
    "check-mutation-audit-belt: FAIL — use jsonOk / schedule*HttpMutationAudit or // audit-exempt: reason",
  );
  process.exit(1);
}
console.log("check-mutation-audit-belt: PASS");
