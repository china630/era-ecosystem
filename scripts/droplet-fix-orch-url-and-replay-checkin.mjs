#!/usr/bin/env node
/**
 * Droplet: stamp orchestratorEventUrl, restart, MDM-link in-house guests, replay check-ins.
 *   node scripts/droplet-fix-orch-url-and-replay-checkin.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

for (const f of [".env", ".env.local", ".env.droplet-pull"]) {
  loadEnvFile(path.join(root, f));
}

function die(msg) {
  console.error(`[replay] ${msg}`);
  process.exit(1);
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function sshTarget() {
  const combined = process.env.ERA_DROPLET_SSH?.trim();
  if (!combined) die("Set ERA_DROPLET_SSH in .env.droplet-pull");
  return combined;
}

function sshKeyArgs() {
  const port = process.env.ERA_DROPLET_SSH_PORT?.trim() || "22";
  const key = expandHome(process.env.ERA_DROPLET_SSH_KEY?.trim());
  const a = ["-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes"];
  if (key) a.push("-i", key);
  return { port, a };
}

const pyLocal = path.join(root, "scripts", "droplet-replay-inhouse-checkin.py");
if (!fs.existsSync(pyLocal)) die(`missing ${pyLocal}`);

const { port, a } = sshKeyArgs();
const remote = "/tmp/droplet-replay-inhouse-checkin.py";
const target = sshTarget();

console.log(`[replay] scp → ${target}`);
const scp = spawnSync(
  "scp",
  ["-P", port, ...a, pyLocal, `${target}:${remote}`],
  { encoding: "utf8", stdio: "inherit" },
);
if (scp.status !== 0) die("scp failed");

console.log("[replay] run on droplet (restart + MDM + events)");
const ssh = spawnSync(
  "ssh",
  ["-p", port, ...a, target, `python3 ${remote}`],
  { encoding: "utf8", stdio: "inherit" },
);
if (ssh.status !== 0) die(`remote python failed (exit ${ssh.status ?? "?"})`);
console.log("[replay] done");
