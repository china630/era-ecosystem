/**
 * Apply catalog-code-canon.map.json to platform diagnostic JSON seeds.
 *   node prisma/scripts/apply-catalog-code-canon.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "seed-data");
const map = JSON.parse(
  fs.readFileSync(path.join(root, "catalog-code-canon.map.json"), "utf8"),
);

function remap(value) {
  if (typeof value === "string") return map[value] || value;
  if (Array.isArray(value)) return value.map(remap);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = remap(v);
    return out;
  }
  return value;
}

const files = [
  path.join(root, "diagnostic-lab-catalog.json"),
  path.join(root, "nafta", "diagnostic-overlay.json"),
];

for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(f, "utf8"));
  const next = remap(raw);
  fs.writeFileSync(f, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log("[canon] wrote", path.relative(path.join(__dirname, "..", ".."), f));
}
