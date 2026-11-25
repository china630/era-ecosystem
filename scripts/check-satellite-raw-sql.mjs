#!/usr/bin/env node
/**
 * Ban raw Prisma SQL in satellite runtime unless each call is a tenant lock:
 * the file calls assertTenantRawOrganizationId, and every SQL literal names
 * organization_id / "organizationId". A comment does not count.
 * Prisma cannot inject organizationId into $queryRaw / $executeRaw.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SATELLITE_ROOTS = [
  "era-hotel-pms",
  "era-clinic",
  "era-fnb-pos",
  "era-retail-pos",
  "era-crm",
  "era-auto-service",
  "era-construction",
  "era-wholesale",
  "era-logistics",
  "era-bank",
  "era-bank-dbo",
  "era-bank-core/apps",
];

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "generated",
  "coverage",
  "prisma",
  "scripts",
]);

const RAW_CALL = /\$(?:queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\b/g;
const ORG_COLUMN = /organization_id|"organizationId"/;
const HELPER_CALL = /\bassertTenantRawOrganizationId\s*\(/;

const hits = [];

function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      i += 2;
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function readLiteral(src, start) {
  const q = src[start];
  if (q !== "'" && q !== '"' && q !== "`") return null;
  let i = start + 1;
  let body = "";
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      body += src[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (q === "`" && c === "$" && src[i + 1] === "{") {
      i += 2;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth += 1;
        else if (src[i] === "}") depth -= 1;
        i += 1;
      }
      continue;
    }
    if (c === q) return { text: body, end: i + 1 };
    body += c;
    i += 1;
  }
  return null;
}

function constStrings(src) {
  const map = new Map();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
  for (const match of src.matchAll(re)) {
    const literal = readLiteral(src, match.index + match[0].length);
    if (literal) map.set(match[1], literal.text);
  }
  return map;
}

function rawSqlLiterals(src) {
  const consts = constStrings(src);
  const found = [];
  for (const match of src.matchAll(RAW_CALL)) {
    let i = match.index + match[0].length;
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (src[i] !== "(" && src[i] !== "`") continue;
    if (src[i] === "(") {
      i += 1;
      while (i < src.length && /\s/.test(src[i])) i += 1;
    }
    const literal = readLiteral(src, i);
    if (literal) {
      found.push(literal.text);
      continue;
    }
    const name = src.slice(i).match(/^[A-Za-z_$][\w$]*/);
    found.push(name && consts.has(name[0]) ? consts.get(name[0]) : null);
  }
  return found;
}

function violations(text) {
  const src = stripComments(text);
  const sqls = rawSqlLiterals(src);
  if (sqls.length === 0) return [];
  const reasons = [];
  if (!HELPER_CALL.test(src)) {
    reasons.push("raw SQL without assertTenantRawOrganizationId(");
  }
  sqls.forEach((sql, index) => {
    if (sql == null) {
      reasons.push(`raw call ${index + 1} is not a SQL literal`);
      return;
    }
    if (!ORG_COLUMN.test(sql)) {
      reasons.push(`raw call ${index + 1} does not filter organization_id`);
    }
  });
  return reasons;
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walk(abs);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(ent.name)) continue;
    if (ent.name.endsWith(".spec.ts") || ent.name.endsWith(".test.ts")) continue;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (rel.includes("/prisma/scripts/")) continue;
    const reasons = violations(fs.readFileSync(abs, "utf8"));
    if (reasons.length) hits.push(`${rel}: ${reasons.join("; ")}`);
  }
}

for (const rel of SATELLITE_ROOTS) {
  walk(path.join(root, rel));
}

if (hits.length) {
  console.error("FAIL: satellite runtime raw SQL is missing a tenant filter:");
  for (const h of hits) console.error("  ", h);
  console.error(
    "Use Prisma queries, or assertTenantRawOrganizationId plus SQL that filters organization_id.",
  );
  process.exit(1);
}

console.log("PASS — satellite raw SQL is tenant-scoped or absent");
