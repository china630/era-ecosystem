#!/usr/bin/env node
/**
 * ERA Security Hygiene Program §4.3 — AuthZ smoke (lab / local).
 *
 * Env:
 *   ORCH_API_URL          default http://127.0.0.1:4000
 *   ORCH_WEB_URL          default http://127.0.0.1:3000
 *   CLINIC_URL            default http://127.0.0.1:3003
 *   HOTEL_URL             default http://127.0.0.1:3002
 *   FINANCE_API_URL       default http://127.0.0.1:4001
 *
 * Exit 0 if all expected denials hold; 1 on unexpected allow/5xx.
 */
const orchApi = (process.env.ORCH_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const orchWeb = (process.env.ORCH_WEB_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const clinic = (process.env.CLINIC_URL ?? "http://127.0.0.1:3003").replace(/\/$/, "");
const hotel = (process.env.HOTEL_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");
const financeApi = (process.env.FINANCE_API_URL ?? "http://127.0.0.1:4001").replace(/\/$/, "");

/** @type {{ name: string; url: string; method?: string; expect: number[] }[]} */
const cases = [
  { name: "unauth orch memberships", url: `${orchApi}/memberships`, expect: [401, 403] },
  {
    name: "unauth cp-mdm BFF",
    url: `${orchWeb}/api/cp-mdm/health`,
    expect: [401, 403],
  },
  {
    name: "unauth clinic events dispatch",
    url: `${clinic}/api/events/dispatch`,
    method: "POST",
    expect: [401, 403],
  },
  {
    name: "unauth hotel staff-provision",
    url: `${hotel}/api/integration/staff-provision`,
    method: "POST",
    expect: [401, 403],
  },
  {
    name: "unauth finance internal network receive",
    url: `${financeApi}/api/internal/v1/network-documents/receive`,
    method: "POST",
    expect: [401, 403],
  },
];

async function runCase(c) {
  const method = c.method ?? "GET";
  let status = 0;
  try {
    const res = await fetch(c.url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" || method === "PUT" || method === "PATCH" ? "{}" : undefined,
    });
    status = res.status;
  } catch (err) {
    return { name: c.name, ok: false, detail: `fetch failed: ${err instanceof Error ? err.message : err}` };
  }
  const ok = c.expect.includes(status);
  return {
    name: c.name,
    ok,
    detail: ok ? `status ${status}` : `status ${status}, expected one of ${c.expect.join(",")}`,
  };
}

const results = [];
for (const c of cases) {
  results.push(await runCase(c));
}

let failed = 0;
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.name} — ${r.detail}`);
}

if (failed > 0) {
  console.error(`\nAuthZ smoke: ${failed}/${results.length} failed`);
  process.exit(1);
}
console.log(`\nAuthZ smoke: ${results.length}/${results.length} passed`);
