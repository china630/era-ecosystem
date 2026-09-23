#!/usr/bin/env node
/**
 * Ban demo-org / demo-clinic-org fallbacks in era-clinic prisma seed scripts.
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaDir = path.join(root, "era-clinic", "prisma");

const FORBIDDEN = [
  /["']demo-org["']/,
  /["']demo-clinic-org["']/,
  /["']demo-bank-org-001["']/,
];

/** Patterns that are allowed comments documenting the ban. */
function isCommentOnly(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("#");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === "seed-data" || name === "node_modules") continue;
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx|js|cjs|mjs)$/.test(name)) continue;
    if (
      !/^(seed|load|backfill)/.test(name) &&
      !full.includes(`${path.sep}scripts${path.sep}`)
    ) {
      continue;
    }
    out.push(full);
  }
  return out;
}

const files = walk(prismaDir);
const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (isCommentOnly(line)) return;
    // Guard clauses that reject demo-org are OK (=== "demo-org" throw / forbidden).
    if (
      /=== ["']demo-org["']|=== ["']demo-clinic-org["']|=== ["']demo-bank-org-001["']/.test(line) ||
      (/forbidden|required|never|ban|throw/i.test(line) && /demo-org|demo-clinic-org/.test(line))
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
  console.error("FAIL: clinic seed org lint — demo-org fallbacks found:\n");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}

console.log(`PASS: clinic seed org lint (${files.length} files)`);
