#!/usr/bin/env node
/**
 * Layer A for hotel, clinic, F&B, retail after the Nest edge cutover.
 * The interceptor only sees Nest controllers. Direct Express registration
 * of the generated route table bypasses it.
 *
 * See docs/adr/era-mutation-audit-standard.md
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const apps = [
  "era-hotel-pms",
  "era-clinic",
  "era-fnb-pos",
  "era-retail-pos",
  "era-auto-service",
  "era-crm",
  "era-logistics",
  "era-wholesale",
  "era-construction",
  "era-bank",
  "era-bank-dbo",
];

let failed = false;

for (const name of apps) {
  const mainPath = path.join(root, name, "nest", "main.ts");
  if (!fs.existsSync(mainPath)) {
    console.error(`FAIL ${name}: missing nest/main.ts`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(mainPath, "utf8");
  if (!text.includes("SatelliteMutationAuditInterceptor")) {
    console.error(`FAIL ${name}: nest/main.ts does not mount SatelliteMutationAuditInterceptor`);
    failed = true;
  }
  if (!text.includes("createSatelliteApiController")) {
    console.error(`FAIL ${name}: nest/main.ts does not serve /api through a Nest controller`);
    failed = true;
  }
  if (/register\w+Routes\(\s*http\s*\)/.test(text)) {
    console.error(`FAIL ${name}: routes are still registered on the raw Express adapter`);
    failed = true;
  }
  if (!failed) console.log(`OK ${name}: Nest mutation audit interceptor`);
}

if (failed) {
  console.error(
    "check-mutation-audit-belt: FAIL — mount SatelliteMutationAuditInterceptor on the Nest API controller",
  );
  process.exit(1);
}
console.log("check-mutation-audit-belt: PASS");
