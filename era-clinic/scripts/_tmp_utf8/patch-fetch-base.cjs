"use strict";
const fs = require("fs");
const f = require("path").join(__dirname, "../nafta-cutover/fetch-lab-files.cjs");
let s = fs.readFileSync(f, "utf8");
s = s.replace(
  /const CLINIC_BASE = process.env.WO_CLINIC_API \|\| "[^"]+"/,
  'const CLINIC_BASE = process.env.WO_CLINIC_API || "https://nafta-clinic.webonly.io"',
);
s = s.replace(/bulk\/lab-results\.json/g, "bulk/lab-results.json");
fs.writeFileSync(f, s);
console.log("ok");
