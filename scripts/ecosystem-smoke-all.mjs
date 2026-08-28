#!/usr/bin/env node
/**
 * Full ecosystem HTTP health smoke (platform + all industry satellites).
 * Usage: node scripts/ecosystem-smoke-all.mjs
 * Env: BASE_URL (optional host prefix), or per-service *_URL overrides.
 *      SMOKE_WAIT_MS — how long to wait for orchestrator before checking the rest.
 * See docs/ECOSYSTEM_URLS.md for default ports.
 */
const base = (process.env.BASE_URL ?? "http://127.0.0.1").replace(/\/$/, "");

const targets = [
  { name: "orchestrator-api", url: process.env.ORCH_URL ?? `${base}:4000`, path: "/health" },
  { name: "finance-api", url: process.env.FINANCE_URL ?? `${base}:4100`, path: "/api/health" },
  { name: "finance-web", url: process.env.FINANCE_WEB_URL ?? `${base}:3100`, path: "/" },
  { name: "data-hub", url: process.env.DATA_HUB_URL ?? `${base}:4200`, path: "/healthz" },
  { name: "hotel-pms", url: process.env.PMS_URL ?? `${base}:3201`, path: "/api/health" },
  { name: "fnb-pos", url: process.env.FNB_URL ?? `${base}:3202`, path: "/api/health" },
  { name: "clinic", url: process.env.CLINIC_URL ?? `${base}:3203`, path: "/api/health" },
  { name: "retail-pos", url: process.env.RETAIL_URL ?? `${base}:3204`, path: "/api/health" },
  { name: "logistics", url: process.env.LOGISTICS_URL ?? `${base}:3205`, path: "/api/health" },
  { name: "construction", url: process.env.CONSTRUCTION_URL ?? `${base}:3206`, path: "/api/health" },
  { name: "crm", url: process.env.CRM_URL ?? `${base}:3207`, path: "/api/health" },
  { name: "auto-service", url: process.env.AUTO_SERVICE_URL ?? `${base}:3208`, path: "/api/health" },
  { name: "wholesale", url: process.env.WHOLESALE_URL ?? `${base}:3209`, path: "/api/health" },
  { name: "bank-core", url: process.env.BANK_CORE_URL ?? `${base}:4300`, path: "/api/health" },
  { name: "bank", url: process.env.BANK_URL ?? `${base}:3210`, path: "/api/health" },
  { name: "bank-dbo", url: process.env.BANK_DBO_URL ?? `${base}:3211`, path: "/api/health" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? 20);
const waitMs = Number(process.env.SMOKE_WAIT_MS ?? 180000);

async function probe(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return res;
}

async function waitUntilReachable(url, label, budgetMs) {
  const deadline = Date.now() + budgetMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await probe(url);
      if (res.status >= 200 && res.status < 500) {
        console.log(`WAIT ${label} ready ${url}`);
        return;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(2000);
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? "timeout");
  throw new Error(`${label} not reachable within ${budgetMs}ms (${msg})`);
}

let failed = 0;
let okCount = 0;

const orch = targets[0];
const orchUrl = `${orch.url.replace(/\/$/, "")}${orch.path}`;
try {
  await waitUntilReachable(orchUrl, orch.name, waitMs);
} catch (err) {
  console.log(`FAIL ${orch.name} ${orchUrl} — ${err instanceof Error ? err.message : err}`);
  failed++;
}

for (const t of targets) {
  if (t === orch && failed > 0) continue;
  const url = `${t.url.replace(/\/$/, "")}${t.path}`;
  let lastErr;
  let res;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      res = await probe(url);
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts - 1) await sleep(2000);
    }
  }
  try {
    if (!res) throw lastErr;
    const ok = res.status >= 200 && res.status < 500;
    console.log(`${ok ? "OK" : "FAIL"} ${t.name} ${res.status} ${url}`);
    if (ok) okCount++;
    else failed++;
  } catch (err) {
    console.log(`FAIL ${t.name} ${url} — ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

console.log(`Ecosystem smoke: ${okCount}/${targets.length} reachable, ${failed} failed`);
if (okCount === 0) {
  console.error("No services reachable.");
  process.exit(1);
}
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
