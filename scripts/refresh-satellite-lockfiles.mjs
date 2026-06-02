#!/usr/bin/env node
/**
 * Regenerate package-lock.json after adding jest to satellite package.json.
 * Usage: node scripts/refresh-satellite-lockfiles.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const satellites = [
  "era-hotel-pms",
  "era-fnb-pos",
  "era-clinic",
  "era-retail-pos",
  "era-logistics",
  "era-construction",
  "era-crm",
  "era-auto-service",
  "era-wholesale",
];

for (const dir of satellites) {
  const cwd = resolve(root, dir);
  console.log(`\n==> npm install (lock refresh): ${dir}`);
  const r = spawnSync("npm", ["install", "--package-lock-only", "--ignore-scripts"], {
    cwd,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`failed: ${dir}`);
    process.exit(r.status ?? 1);
  }
}

console.log("\n==> refresh-satellite-lockfiles: done");
