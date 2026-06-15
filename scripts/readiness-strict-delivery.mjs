#!/usr/bin/env node
// SHIPPED-only DELIVERY % — excludes [~] API-only, [s] stub, [h] headless tags.
// Usage: node scripts/readiness-strict-delivery.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".git") continue;
      walk(full, acc);
    } else if (/^DELIVERY.*\.md$/i.test(name.name) && full.includes(`${path.sep}doc${path.sep}`)) {
      acc.push(full);
    }
  }
  return acc;
}

function countStrict(text) {
  const shipped = (text.match(/^- \[x\]/gim) ?? []).length;
  const apiOnly = (text.match(/^- \[~\]/gim) ?? []).length;
  const stub = (text.match(/^- \[s\]/gim) ?? []).length;
  const headless = (text.match(/^- \[h\]/gim) ?? []).length;
  const open = (text.match(/^- \[ \]/gim) ?? []).length;
  const denominator = shipped + open;
  const pct = denominator === 0 ? 0 : Math.round((shipped / denominator) * 100);
  return { shipped, apiOnly, stub, headless, open, denominator, pct };
}

const files = walk(root).sort();
const rows = files.map((file) => {
  const text = fs.readFileSync(file, "utf8");
  const counts = countStrict(text);
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const app = rel.split("/")[0];
  return { app, file: rel, ...counts };
});

const json = process.argv.includes("--json");
if (json) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  process.exit(0);
}

console.log("ERA DELIVERY strict (SHIPPED [x] only)\n");
console.log("| Application | Shipped | API [~] | Stub [s] | Headless [h] | Open | Strict % |");
console.log("|-------------|---------|---------|----------|--------------|------|----------|");
for (const r of rows) {
  console.log(
    `| ${r.app} | ${r.shipped} | ${r.apiOnly} | ${r.stub} | ${r.headless} | ${r.open} | ${r.pct}% |`,
  );
}
const sumShipped = rows.reduce((s, r) => s + r.shipped, 0);
const sumOpen = rows.reduce((s, r) => s + r.open, 0);
const avg = sumShipped + sumOpen === 0 ? 0 : Math.round((sumShipped / (sumShipped + sumOpen)) * 100);
console.log(`\nStrict aggregate: ${sumShipped}/${sumShipped + sumOpen} (${avg}%) across ${rows.length} files.`);
