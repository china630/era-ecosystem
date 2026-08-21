#!/usr/bin/env node
/**
 * Bundle quality gates used before PR / in CI packages job.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

function run(label, cmd, args) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", shell: true, stdio: "inherit" });
  if ((r.status ?? 1) !== 0) {
    console.error(`FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
}

run("acceptance consistency", "node", [
  "scripts/check-acceptance-consistency.mjs",
  ...(strict ? ["--strict"] : []),
]);
run("satellite raw SQL ban", "node", ["scripts/check-satellite-raw-sql.mjs"]);
run("integration audit strict", "npm", ["run", "audit:integration:strict"]);
run("design tokens", "npm", ["run", "lint:design-tokens"]);
run("token layers", "npm", ["run", "lint:token-layers"]);

console.log("\nPASS — quality gates");
