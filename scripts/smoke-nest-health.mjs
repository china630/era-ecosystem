import { spawn } from "node:child_process";
import path from "node:path";

const root = "d:/My Projects/era-ecosystem";
const satellites = [
  ["era-fnb-pos", "era_fnb_pos", 13202, "fnb nest http"],
  ["era-retail-pos", "era_retail_pos", 13204, "retail nest http"],
  ["era-logistics", "era_logistics", 13205, "logistics nest http"],
  ["era-construction", "era_construction", 13206, "construction nest http"],
  ["era-crm", "era_crm", 13207, "crm nest http"],
  ["era-auto-service", "era_auto_service", 13208, "auto nest http"],
  ["era-wholesale", "era_wholesale", 13209, "wholesale nest http"],
  ["era-bank", "era_bank", 13210, "bank nest http"],
  ["era-bank-dbo", "era_bank_dbo", 13211, "dbo nest http"],
];

function start(cwd, env) {
  return spawn("npx", ["tsx", "nest/main.ts"], { cwd, env, shell: true, windowsHide: true });
}

function waitFor(child, pattern) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`timeout ${pattern}`)), 30000);
    const onData = (chunk) => {
      buf += chunk.toString();
      if (buf.includes(pattern)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`exit ${code}: ${buf.slice(-300)}`));
    });
  });
}

function killTree(child) {
  if (child?.pid) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { shell: true, windowsHide: true });
}

for (const [app, db, port, ready] of satellites) {
  const child = start(path.join(root, app), {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:5433/${db}?schema=public`,
    ORCHESTRATOR_URL: "http://127.0.0.1:4000",
    SATELLITE_EVENT_SERVICE_TOKEN: "dev-satellite-event-token",
  });
  try {
    await waitFor(child, ready);
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const powered = res.headers.get("x-powered-by");
    console.log(`${app} ${res.status} ${powered} ${text.slice(0, 80)}`);
    if (res.status !== 200 || powered !== "Express") process.exitCode = 1;
  } catch (err) {
    console.log(`${app} FAIL ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    killTree(child);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}
console.log("smoke done");
