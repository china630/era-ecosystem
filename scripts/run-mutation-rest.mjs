/**
 * One satellite at a time: Nest, Next, unauthenticated mutation compare, then stop both.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(".");
const satellites = [
  ["era-crm", "era_crm", 23207, 13207, "crm", "crm nest http"],
  ["era-logistics", "era_logistics", 23205, 13205, "logistics", "logistics nest http"],
  ["era-wholesale", "era_wholesale", 23209, 13209, "wholesale", "wholesale nest http"],
  ["era-construction", "era_construction", 23206, 13206, "construction", "construction nest http"],
  ["era-bank-dbo", "era_bank_dbo", 23211, 13211, "dbo", "dbo nest http"],
];

function run(cmd, args, opts) {
  return spawn(cmd, args, { ...opts, shell: true, windowsHide: true });
}

function waitFor(child, pattern, ms) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${pattern}`)), ms);
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
      reject(new Error(`exited ${code} before ${pattern}: ${buf.slice(-400)}`));
    });
  });
}

function killTree(child) {
  if (!child?.pid) return;
  spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { shell: true, windowsHide: true });
}

for (const [app, db, nextPort, nestPort, tag, ready] of satellites) {
  const cwd = path.join(root, app);
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:5433/${db}?schema=public`,
    ORCHESTRATOR_URL: "http://127.0.0.1:4000",
    SATELLITE_EVENT_SERVICE_TOKEN: "dev-satellite-event-token",
  };
  console.log(`\n== ${tag} ==`);
  const nest = run("npx", ["tsx", "nest/main.ts"], { cwd, env });
  const next = run("npx", ["next", "dev", "-p", String(nextPort)], { cwd, env });
  try {
    await Promise.all([waitFor(nest, ready, 40000), waitFor(next, "Ready", 90000)]);
    const code = await new Promise((resolve) => {
      const compare = run("node", ["scripts/compare-satellite-mutations.mjs"], {
        cwd: root,
        env: {
          ...env,
          COMPARE_APP: app,
          COMPARE_NEXT: `http://127.0.0.1:${nextPort}`,
          COMPARE_NEST: `http://127.0.0.1:${nestPort}`,
          COMPARE_TAG: tag,
        },
      });
      compare.stdout?.on("data", (chunk) => process.stdout.write(chunk));
      compare.stderr?.on("data", (chunk) => process.stderr.write(chunk));
      compare.on("exit", resolve);
    });
    console.log(`${tag} compare exit ${code}`);
    if (code === 2) break;
  } catch (err) {
    console.log(`STOP ${tag} ${err instanceof Error ? err.message : err}`);
    break;
  } finally {
    killTree(nest);
    killTree(next);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
console.log("mutation rest finished");
