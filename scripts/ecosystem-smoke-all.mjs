#!/usr/bin/env node
/**
 * Full ecosystem HTTP health smoke (platform + all industry satellites).
 * Usage: node scripts/ecosystem-smoke-all.mjs
 * Env: BASE_URL (optional host prefix), or per-service *_URL overrides.
 * See docs/ECOSYSTEM_URLS.md for default ports.
 */
const base = (process.env.BASE_URL ?? "http://127.0.0.1").replace(/\/$/, "");

const targets = [
  { name: "orchestrator-api", url: process.env.ORCH_URL ?? `${base}:4000`, path: "/health" },
  { name: "finance-api", url: process.env.FINANCE_URL ?? `${base}:4100`, path: "/api/health" },
  { name: "finance-web", url: process.env.FINANCE_WEB_URL ?? `${base}:3100`, path: "/" },
  { name: "data-hub", url: process.env.DATA_HUB_URL ?? `${base}:4200`, path: "/health" },
  { name: "hotel-pms", url: process.env.PMS_URL ?? `${base}:3201`, path: "/api/health" },
  { name: "fnb-pos", url: process.env.FNB_URL ?? `${base}:3202`, path: "/api/health" },
  { name: "clinic", url: process.env.CLINIC_URL ?? `${base}:3203`, path: "/api/health" },
  { name: "retail-pos", url: process.env.RETAIL_URL ?? `${base}:3204`, path: "/api/health" },
  { name: "logistics", url: process.env.LOGISTICS_URL ?? `${base}:3205`, path: "/api/health" },
  { name: "construction", url: process.env.CONSTRUCTION_URL ?? `${base}:3206`, path: "/api/health" },
  { name: "crm", url: process.env.CRM_URL ?? `${base}:3207`, path: "/api/health" },
  { name: "auto-service", url: process.env.AUTO_SERVICE_URL ?? `${base}:3208`, path: "/api/health" },
  { name: "wholesale", url: process.env.WHOLESALE_URL ?? `${base}:3209`, path: "/api/health" },
];

let failed = 0;
let okCount = 0;

for (const t of targets) {
  const url = `${t.url.replace(/\/$/, "")}${t.path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
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
