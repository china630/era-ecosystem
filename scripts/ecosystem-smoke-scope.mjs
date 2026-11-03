/**
 * Blocking HTTP health for the services just deployed.
 * Usage: node scripts/ecosystem-smoke-scope.mjs hotel-pms clinic
 * Env: SMOKE_ATTEMPTS, SMOKE_GAP_MS, BASE_URL, per-service *_URL like the other smokes.
 */
const base = (process.env.BASE_URL ?? "http://127.0.0.1").replace(/\/$/, "");

const catalog = {
  orchestrator: { name: "orchestrator-api", url: process.env.ORCH_URL ?? `${base}:4000`, path: "/health" },
  "finance-core": { name: "finance-api", url: process.env.FINANCE_URL ?? `${base}:4100`, path: "/api/health" },
  "finance-web": { name: "finance-web", url: process.env.FINANCE_WEB_URL ?? `${base}:3100`, path: "/" },
  "data-hub": { name: "data-hub", url: process.env.DATA_HUB_URL ?? `${base}:4200`, path: "/healthz" },
  "hotel-pms": { name: "hotel-pms", url: process.env.PMS_URL ?? `${base}:3201`, path: "/api/health" },
  "fnb-pos": { name: "fnb-pos", url: process.env.FNB_URL ?? `${base}:3202`, path: "/api/health" },
  clinic: { name: "clinic", url: process.env.CLINIC_URL ?? `${base}:3203`, path: "/api/health" },
  "retail-pos": { name: "retail-pos", url: process.env.RETAIL_URL ?? `${base}:3204`, path: "/api/health" },
  logistics: { name: "logistics", url: process.env.LOGISTICS_URL ?? `${base}:3205`, path: "/api/health" },
  construction: { name: "construction", url: process.env.CONSTRUCTION_URL ?? `${base}:3206`, path: "/api/health" },
  crm: { name: "crm", url: process.env.CRM_URL ?? `${base}:3207`, path: "/api/health" },
  "auto-service": { name: "auto-service", url: process.env.AUTO_SERVICE_URL ?? `${base}:3208`, path: "/api/health" },
  wholesale: { name: "wholesale", url: process.env.WHOLESALE_URL ?? `${base}:3209`, path: "/api/health" },
  "bank-core": { name: "bank-core", url: process.env.BANK_CORE_URL ?? `${base}:4300`, path: "/api/health" },
  bank: { name: "bank", url: process.env.BANK_URL ?? `${base}:3210`, path: "/api/health" },
  "bank-dbo": { name: "bank-dbo", url: process.env.BANK_DBO_URL ?? `${base}:3211`, path: "/api/health" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? 30);
const gapMs = Number(process.env.SMOKE_GAP_MS ?? 2000);
const names = process.argv.slice(2).filter(Boolean);

if (names.length === 0) {
  console.error("ecosystem-smoke-scope: pass compose service names");
  process.exit(1);
}

let failed = 0;
for (const name of names) {
  const t = catalog[name];
  if (!t) {
    console.error(`FAIL unknown service ${name}`);
    failed++;
    continue;
  }
  const url = `${t.url.replace(/\/$/, "")}${t.path}`;
  let ok = false;
  let last = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
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
  console.error(`Scope smoke FAILED (${failed}/${names.length})`);
  process.exit(1);
}
console.log(`Scope smoke PASS (${names.length}/${names.length})`);
process.exit(0);
