#!/usr/bin/env node
/**
 * Ban demo-org / demo-clinic-org / demo-bank-org-001 fallbacks in satellite seed scripts.
 * Scans era-* prisma seed files and upsert-ecosystem-demo-user.ts
 * ADR: docs/adr/satellite-seed-hygiene.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN = [
  /["']demo-org["']/,
  /["']demo-clinic-org["']/,
  /["']demo-bank-org-001["']/,
];

function isCommentOnly(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("#");
}

function shouldScanFile(name, full) {
  if (!/\.(ts|tsx|js|cjs|mjs)$/.test(name)) return false;
  if (name === "upsert-ecosystem-demo-user.ts") return true;
  if (/^(seed|load|backfill)/.test(name)) return true;
  if (full.includes(`${path.sep}scripts${path.sep}`) && /seed|upsert/.test(name)) {
    return true;
  }
  return false;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === "seed-data" || name === "node_modules" || name === "generated") continue;
      walk(full, out);
      continue;
    }
    if (shouldScanFile(name, full)) out.push(full);
  }
  return out;
}

const eraDirs = fs
  .readdirSync(root)
  .filter((n) => n.startsWith("era-") && fs.statSync(path.join(root, n)).isDirectory());

const files = [];
for (const dir of eraDirs) {
  const prismaDir = path.join(root, dir, "prisma");
  walk(prismaDir, files);
  const nested = path.join(root, dir, "packages");
  if (fs.existsSync(nested)) {
    for (const pkg of fs.readdirSync(nested)) {
      walk(path.join(nested, pkg, "prisma"), files);
    }
  }
}

const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (isCommentOnly(line)) return;
    if (
      /=== ["']demo-org["']|=== ["']demo-clinic-org["']|=== ["']demo-bank-org-001["']/.test(line) ||
      (/forbidden|required|never|ban|throw/i.test(line) &&
        /demo-org|demo-clinic-org|demo-bank-org/.test(line))
    ) {
      return;
    }
    for (const re of FORBIDDEN) {
      if (re.test(line)) {
        violations.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
      }
    }
  });
}

if (violations.length) {
  console.error("FAIL: satellite seed org lint — demo-org fallbacks found:\n");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}

console.log(`PASS: satellite seed org lint (${files.length} files across ${eraDirs.length} apps)`);
