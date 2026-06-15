#!/usr/bin/env node
/**
 * Posting engine load benchmark — parallel internal transfer fixture.
 * Target: 500 txns / 60s, zero balance drift (verify via replay-day after burst).
 */
const BASE = (process.env.ERA_BANK_CORE_URL ?? "http://127.0.0.1:4300").replace(/\/$/, "");
const TOKEN = process.env.BANK_CORE_SERVICE_TOKEN ?? "dev-bank-core-service-token";
const TOTAL = Number(process.env.BENCH_TOTAL ?? "500");
const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY ?? "25");

async function postOnce(i, fixture) {
  const started = performance.now();
  const res = await fetch(`${BASE}/api/v1/postings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference: `BENCH-${Date.now()}-${i}`,
      idempotencyKey: `bench-${Date.now()}-${i}`,
      valueDate: new Date().toISOString(),
      type: "INTERNAL_TRANSFER",
      makerUserId: "bench",
      branchId: fixture.branchId,
      autoApprove: true,
      legs: fixture.legs,
    }),
  });
  const ms = performance.now() - started;
  return { ok: res.ok, status: res.status, ms };
}

async function runPool(tasks, limit) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx;
      idx += 1;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  const health = await fetch(`${BASE}/api/health`);
  if (!health.ok) {
    console.error("bank-core health failed");
    process.exit(1);
  }

  // Minimal fixture — requires seeded accounts/branches in dev DB.
  const fixtureRes = await fetch(`${BASE}/api/v1/branches`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const branches = fixtureRes.ok ? await fixtureRes.json() : [];
  const branchId = branches[0]?.id ?? "seed-required";
  const fixture = {
    branchId,
    legs: [
      {
        glAccountId: "seed-required",
        branchId,
        debitMinor: "100",
        creditMinor: "0",
        currency: "AZN",
      },
      {
        glAccountId: "seed-required",
        branchId,
        debitMinor: "0",
        creditMinor: "100",
        currency: "AZN",
      },
    ],
  };

  const started = Date.now();
  const tasks = Array.from({ length: TOTAL }, (_, i) => () => postOnce(i, fixture));
  const results = await runPool(tasks, CONCURRENCY);
  const elapsed = (Date.now() - started) / 1000;
  const ok = results.filter((r) => r.ok).length;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  console.log(
    JSON.stringify(
      {
        total: TOTAL,
        ok,
        errors: TOTAL - ok,
        elapsedSec: elapsed,
        tps: ok / elapsed,
        p50Ms: p50,
        p95Ms: p95,
        targetMet: ok >= TOTAL * 0.95 && elapsed <= 60,
      },
      null,
      2,
    ),
  );
  process.exit(ok >= TOTAL * 0.95 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
