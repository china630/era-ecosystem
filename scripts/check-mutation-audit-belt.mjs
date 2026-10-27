#!/usr/bin/env node
/**
 * CI stub: industry satellites that claim Layer A must hook jsonOk → schedule*HttpMutationAudit.
 * See docs/adr/era-mutation-audit-standard.md
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apps = [
  {
    name: "era-hotel-pms",
    apiUtils: "era-hotel-pms/src/lib/api-utils.ts",
    needle: "scheduleHotelHttpMutationAudit",
  },
  {
    name: "era-fnb-pos",
    apiUtils: "era-fnb-pos/src/lib/api-utils.ts",
    needle: "scheduleFnbHttpMutationAudit",
  },
  {
    name: "era-clinic",
    apiUtils: "era-clinic/src/lib/api-utils.ts",
    needle: "scheduleClinicHttpMutationAudit",
  },
];

let failed = false;
for (const app of apps) {
  const file = path.join(root, app.apiUtils);
  if (!fs.existsSync(file)) {
    console.error(`FAIL ${app.name}: missing ${app.apiUtils}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(app.needle)) {
    console.error(`FAIL ${app.name}: ${app.apiUtils} missing ${app.needle}`);
    failed = true;
  } else {
    console.log(`OK ${app.name}: Layer A hook present`);
  }
}

if (failed) process.exit(1);
console.log("check-mutation-audit-belt: PASS");
