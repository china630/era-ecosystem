/**
 * Watchdog: keeps enrich-etaxes running until .enrich-complete.json exists.
 * Safe to run alongside an in-flight enrich — waits if another node process is active.
 *
 * Usage: node tools/enrich-etaxes-resume.mjs
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const COMPLETE_MARKER = path.join(ROOT, "data/legal-entities/.enrich-complete.json");
const SCRIPT = path.join(ROOT, "tools/enrich-etaxes-legal-entities.mjs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isComplete() {
  return fs.existsSync(COMPLETE_MARKER);
}

function isEnrichRunning() {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'wmic process where "name=\'node.exe\'" get commandline /format:list',
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
      );
      return out.includes("enrich-etaxes-legal-entities.mjs");
    }
    const out = execSync("ps aux", { encoding: "utf8" });
    return out.includes("enrich-etaxes-legal-entities.mjs");
  } catch {
    return false;
  }
}

function runEnrich() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd: ROOT,
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  console.log("enrich-etaxes watchdog started");
  let attempt = 0;
  while (!isComplete()) {
    if (isEnrichRunning()) {
      process.stdout.write(`[watchdog] enrich in progress, waiting 60s...\r`);
      await sleep(60_000);
      continue;
    }
    attempt++;
    console.log(`\n[watchdog] starting enrich (attempt ${attempt})...`);
    const code = await runEnrich();
    if (isComplete()) {
      console.log("[watchdog] complete.");
      break;
    }
    console.log(`[watchdog] exited with code ${code}, retry in 30s...`);
    await sleep(30_000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
