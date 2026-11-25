#!/usr/bin/env node
/**
 * Nest imports from `@era/satellite-kit` must exist in the committed barrel.
 * The working tree copy of packages/satellite-kit does not count: images build from git.
 *
 * Checks names added since origin/dev (or --base). Pre-existing imports stay as debt.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baseIdx = process.argv.indexOf("--base");
const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : "origin/dev";

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function exportNames(source) {
  const names = new Set();
  const withoutTypes = source
    .replace(/export\s+type\s*\{[\s\S]*?\}/g, "")
    .replace(/export\s+interface\s+\w+/g, "");
  for (const block of withoutTypes.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
    for (const part of block[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/i)[0]?.trim();
      if (name && /^[A-Za-z_]/.test(name)) names.add(name);
    }
  }
  for (const match of withoutTypes.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
    names.add(match[1]);
  }
  return names;
}

function namedImports(source) {
  const names = new Set();
  if (!source) return names;
  const re = /import\s+(type\s+)?\{([^}]+)\}\s*from\s*["']@era\/satellite-kit["']/g;
  for (const match of source.matchAll(re)) {
    if (match[1]) continue;
    for (const part of match[2].split(",")) {
      const name = part.trim().split(/\s+as\s+/i)[0]?.trim();
      if (name && /^[A-Za-z_]/.test(name)) names.add(name);
    }
  }
  return names;
}

const barrelPath = "packages/satellite-kit/src/index.ts";
const stagedBarrel = tryGit(["show", `:${barrelPath}`]);
const headBarrel = tryGit(["show", `HEAD:${barrelPath}`]);
const barrel = stagedBarrel != null && stagedBarrel !== headBarrel ? stagedBarrel : headBarrel;
if (barrel == null) {
  console.error("check-satellite-kit-exports: cannot read packages/satellite-kit/src/index.ts from git");
  process.exit(1);
}
const exported = exportNames(barrel);

const nestDirs = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "nest")))
  .map((entry) => `${entry.name}/nest`);

function names(args) {
  return git(args)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((line) => line.endsWith(".ts") || line.endsWith(".tsx"));
}

const changed = new Set([
  ...names(["diff", "--name-only", "--cached", "--", ...nestDirs]),
  ...names(["diff", "--name-only", `${base}...HEAD`, "--", ...nestDirs]),
]);

const problems = [];
for (const file of changed) {
  const disk = path.join(root, file);
  const next = fs.existsSync(disk) ? fs.readFileSync(disk, "utf8") : tryGit(["show", `HEAD:${file}`]);
  const prev = tryGit(["show", `${base}:${file}`]) ?? "";
  if (next == null) continue;
  const added = [...namedImports(next)].filter((name) => !namedImports(prev).has(name));
  for (const name of added) {
    if (!exported.has(name)) {
      problems.push(`${file}: imports ${name}, missing from committed @era/satellite-kit barrel`);
    }
  }
}

if (problems.length > 0) {
  console.error("Satellite kit imports are not in the committed barrel (disk-only exports do not ship):");
  for (const line of problems) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`check-satellite-kit-exports: ok (${changed.size} ts files vs ${base})`);
