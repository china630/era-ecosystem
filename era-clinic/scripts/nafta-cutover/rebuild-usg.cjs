"use strict";

/**
 * Rebuild only clinic #29 (USG Müayinə Anketi). Does not touch lab or hotel READY.
 *
 *   node era-clinic/scripts/nafta-cutover/rebuild-usg.cjs
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const clinicRoot = path.join(__dirname, "../..");
const script = path.join(__dirname, "rebuild-usg.ts");
const tsxCandidates = [
  path.join(__dirname, "../../../era-hotel-pms/node_modules/tsx/dist/cli.mjs"),
  path.join(clinicRoot, "node_modules/tsx/dist/cli.mjs"),
  path.join(__dirname, "../../../node_modules/tsx/dist/cli.mjs"),
];
const tsx = tsxCandidates.find((p) => fs.existsSync(p));
const r = tsx
  ? spawnSync(process.execPath, [tsx, script], { cwd: clinicRoot, stdio: "inherit" })
  : spawnSync("npx", ["--yes", "tsx", script], { cwd: clinicRoot, stdio: "inherit", shell: true });
process.exit(r.status || 0);
