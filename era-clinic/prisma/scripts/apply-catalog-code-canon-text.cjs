/**
 * Replace old diagnostic codes in clinic source/tests/docs (quoted identifiers).
 *   node prisma/scripts/apply-catalog-code-canon-text.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const clinicRoot = path.join(__dirname, "..", "..");
const map = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "seed-data", "catalog-code-canon.map.json"),
    "utf8",
  ),
);

const keys = Object.keys(map).sort((a, b) => b.length - a.length);

const SKIP = new Set([
  path.normalize("prisma/seed-data/catalog-code-canon.map.json"),
  path.normalize("prisma/scripts/export-catalog-code-canon.cjs"),
  path.normalize("prisma/scripts/apply-catalog-code-canon.cjs"),
  path.normalize("prisma/scripts/apply-catalog-code-canon-text.cjs"),
]);

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    const rel = path.relative(clinicRoot, full).replace(/\\/g, "/");
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (rel === "prisma/seed-data") {
        /* JSON already remapped; still walk scripts */
      }
      walk(full, acc);
      continue;
    }
    if (!/\.(ts|tsx|js|cjs|mjs|md)$/.test(name)) continue;
    if (SKIP.has(path.normalize(rel))) continue;
    if (rel.startsWith("prisma/seed-data/") && rel.endsWith(".json")) continue;
    acc.push(full);
  }
}

const files = [];
for (const sub of ["src", "__tests__", "prisma", "scripts", "doc"]) {
  walk(path.join(clinicRoot, sub), files);
}

let filesTouched = 0;
let replacements = 0;
for (const f of files) {
  let text = fs.readFileSync(f, "utf8");
  const orig = text;
  for (const old of keys) {
    const neu = map[old];
    if (old === neu) continue;
    const quoted = new RegExp(
      `(['"\`])${old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`,
      "g",
    );
    const next = text.replace(quoted, `$1${neu}$1`);
    if (next !== text) {
      replacements += (text.match(quoted) || []).length;
      text = next;
    }
  }
  if (text !== orig) {
    fs.writeFileSync(f, text, "utf8");
    filesTouched += 1;
  }
}
console.log("[canon-text] files", filesTouched, "replacements", replacements);
