#!/usr/bin/env node
// Count DELIVERY checkboxes in era-*/doc/DELIVERY-*.md files.
// Usage: node scripts/delivery-readiness.mjs [--json]
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

function countCheckboxes(text) {
  const done = (text.match(/^- \[x\]/gim) ?? []).length;
  const open = (text.match(/^- \[ \]/gim) ?? []).length;
  const total = done + open;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, open, total, pct };
}

const files = walk(root).sort();
const rows = files.map((file) => {
  const text = fs.readFileSync(file, "utf8");
  const counts = countCheckboxes(text);
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const app = rel.split("/")[0];
  return { app, file: rel, ...counts };
});

const json = process.argv.includes("--json");
if (json) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  process.exit(0);
}

console.log("ERA DELIVERY readiness\n");
console.log("| Application | Done | Open | Total | % | File |");
console.log("|-------------|------|------|-------|---|------|");
for (const r of rows) {
  console.log(`| ${r.app} | ${r.done} | ${r.open} | ${r.total} | ${r.pct}% | ${r.file} |`);
}
const sumDone = rows.reduce((s, r) => s + r.done, 0);
const sumOpen = rows.reduce((s, r) => s + r.open, 0);
const sumTotal = sumDone + sumOpen;
const avg = sumTotal === 0 ? 0 : Math.round((sumDone / sumTotal) * 100);
console.log(`\nAggregate: ${sumDone}/${sumTotal} (${avg}%) across ${rows.length} DELIVERY files.`);
