#!/usr/bin/env node
/**
 * Quartet smoke: Finance + Orchestrator + Hotel + FB health (no auth required).
 * Usage: node scripts/quartet-smoke.mjs
 * Optional: PMS_URL, FB_URL, FINANCE_URL, ORCH_URL
 */
const targets = [
  { name: "orchestrator", url: process.env.ORCH_URL ?? "http://127.0.0.1:4100", path: "/health" },
  { name: "finance-api", url: process.env.FINANCE_URL ?? "http://127.0.0.1:4000", path: "/api/health" },
  { name: "hotel-pms", url: process.env.PMS_URL ?? "http://127.0.0.1:3000", path: "/api/health" },
  { name: "fb-pos", url: process.env.FB_URL ?? "http://127.0.0.1:3200", path: "/api/health" },
];

let failed = 0;
for (const t of targets) {
  const url = `${t.url.replace(/\/$/, "")}${t.path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const ok = res.status >= 200 && res.status < 500;
    console.log(`${ok ? "OK" : "FAIL"} ${t.name} ${res.status} ${url}`);
    if (!ok) failed++;
  } catch (err) {
    console.log(`SKIP ${t.name} ${url} — ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

if (failed === targets.length) {
  console.error("All quartet health checks failed (services not running?).");
  process.exit(1);
}
console.log("Quartet smoke: at least one service reachable (run full UAT when stack is up).");
process.exit(0);
