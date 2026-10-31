#!/usr/bin/env node
/**
 * Blocking critical-path smoke for droplet deploy (control plane + money).
 * Satellites (clinic/hotel/…) are checked by ecosystem-smoke-all (non-blocking warn).
 *
 * Usage: node scripts/ecosystem-smoke-critical.mjs
 * Env: BASE_URL (default http://127.0.0.1), SMOKE_WAIT_MS, SMOKE_ATTEMPTS
 */
const base = (process.env.BASE_URL ?? "http://127.0.0.1").replace(/\/$/, "");

const targets = [
  {
    name: "finance-api",
    url: process.env.FINANCE_URL ?? `${base}:4100`,
    path: "/api/health",
  },
  {
    name: "orchestrator-api",
    url: process.env.ORCH_URL ?? `${base}:4000`,
    path: "/health",
  },
  {
    name: "data-hub",
    url: process.env.DATA_HUB_URL ?? `${base}:4200`,
    path: "/healthz",
  },
  {
    name: "finance-web",
    url: process.env.FINANCE_WEB_URL ?? `${base}:3100`,
    path: "/",
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? 30);
const gapMs = Number(process.env.SMOKE_GAP_MS ?? 2000);

async function probe(url) {
  return fetch(url, { signal: AbortSignal.timeout(8000) });
}

let failed = 0;
for (const t of targets) {
  const url = `${t.url.replace(/\/$/, "")}${t.path}`;
  let ok = false;
  let last = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await probe(url);
      if (res.status >= 200 && res.status < 500) {
        console.log(`OK ${t.name} ${res.status} ${url}`);
        ok = true;
        break;
      }
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await sleep(gapMs);
  }
  if (!ok) {
    console.log(`FAIL ${t.name} ${url} — ${last}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`Critical smoke FAILED (${failed}/${targets.length})`);
  process.exit(1);
}
console.log(`Critical smoke PASS (${targets.length}/${targets.length})`);
process.exit(0);
