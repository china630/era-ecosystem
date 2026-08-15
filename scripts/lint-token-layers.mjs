#!/usr/bin/env node
/**
 * Enforce 3-tier design token layering (hybrid model) inside tokens/.
 *
 * Rules:
 * 1. tokens/semantic.ts (L2) must not contain raw hex - only L1 references.
 * 2. Every hex in tokens/components.ts (L3) must exist in tokens/primitives.ts (L1).
 * 3. design-system.ts facade must not introduce raw hex (re-export only).
 *
 * Broader app/UI raw-hex debt remains under lint:design-tokens baseline.
 *
 * Usage:
 *   node scripts/lint-token-layers.mjs
 *   node scripts/lint-token-layers.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = path.join(root, "packages/satellite-kit/src/ui");
const primitivesPath = path.join(uiRoot, "tokens/primitives.ts");
const componentsPath = path.join(uiRoot, "tokens/components.ts");
const semanticPath = path.join(uiRoot, "tokens/semantic.ts");
const facadePath = path.join(uiRoot, "design-system.ts");
const jsonOut = process.argv.includes("--json");

const HEX_RE = /#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b/g;

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function hexesIn(text) {
  const set = new Set();
  for (const m of text.matchAll(HEX_RE)) {
    set.add(m[0].toUpperCase());
  }
  return set;
}

const l1 = hexesIn(read(primitivesPath));
const l3 = hexesIn(read(componentsPath));
const semHex = hexesIn(read(semanticPath));
const facadeHex = hexesIn(read(facadePath));

const errors = [];

if (semHex.size > 0) {
  errors.push({
    rule: "semantic-no-raw-hex",
    message: "tokens/semantic.ts contains raw hex (must reference L1 only): " + [...semHex].join(", "),
  });
}

if (facadeHex.size > 0) {
  errors.push({
    rule: "facade-no-raw-hex",
    message: "design-system.ts must re-export only; found hex: " + [...facadeHex].join(", "),
  });
}

for (const h of l3) {
  if (!l1.has(h)) {
    errors.push({
      rule: "components-hex-not-in-primitives",
      message: "tokens/components.ts uses " + h + " missing from tokens/primitives.ts COLOR",
    });
  }
}

if (l1.size < 8) {
  errors.push({
    rule: "primitives-too-thin",
    message: "tokens/primitives.ts expected a full palette; found " + l1.size + " hex values",
  });
}

const report = { l1Count: l1.size, l3Count: l3.size, l1: [...l1].sort(), l3: [...l3].sort(), errors };

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("Token layer lint (3-tier hybrid)\n");
  console.log("L1 primitives hex count: " + l1.size);
  console.log("L3 components hex count: " + l3.size);
  if (errors.length === 0) {
    console.log("\nOK - layers aligned.");
  } else {
    console.log("\n" + errors.length + " error(s):");
    for (const e of errors) console.log("  [" + e.rule + "] " + e.message);
  }
}

process.exit(errors.length > 0 ? 1 : 0);
