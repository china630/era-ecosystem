#!/usr/bin/env node
/**
 * Copy committed .githooks/pre-push into .git/hooks (no git config change).
 *   node scripts/install-era-git-hooks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, ".githooks", "pre-push");
const gitDir = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: root, encoding: "utf8" });
if (gitDir.status !== 0) {
  console.error("Not a git repo");
  process.exit(1);
}
const hooksDir = path.join(root, gitDir.stdout.trim(), "hooks");
fs.mkdirSync(hooksDir, { recursive: true });
const dest = path.join(hooksDir, "pre-push");
const body = fs.readFileSync(src, "utf8");
fs.writeFileSync(dest, body, { encoding: "utf8" });
try {
  fs.chmodSync(dest, 0o755);
} catch {
  // Windows: chmod may no-op; Git for Windows still runs #!/bin/sh hooks.
}
console.log(`Installed git hook: ${path.relative(root, dest)}`);
