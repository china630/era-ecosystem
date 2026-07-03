#!/usr/bin/env node
/**
 * v3 Workforce cutover smoke — policy, CP routes, clinic hire block.
 * Usage:
 *   ORCH_API_URL=http://127.0.0.1:4000 \
 *   ORCH_SUPER_ADMIN_TOKEN=... \
 *   ERA_HOTEL_ORGANIZATION_ID=... \
 *   CLINIC_URL=http://127.0.0.1:3203 \
 *   node scripts/v3-workforce-smoke.mjs
 */
const orchBase = (process.env.ORCH_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const clinicBase = (process.env.CLINIC_URL ?? "http://127.0.0.1:3203").replace(/\/$/, "");
const token = process.env.ORCH_SUPER_ADMIN_TOKEN?.trim() || process.env.ORCH_OWNER_TOKEN?.trim();
const orgId = process.env.ERA_HOTEL_ORGANIZATION_ID?.trim();

let failed = 0;

function fail(msg) {
  console.log(`FAIL ${msg}`);
  failed += 1;
}

function ok(msg) {
  console.log(`OK   ${msg}`);
}

async function orchFetch(path, init = {}) {
  const headers = {
    ...(init.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { "x-organization-id": orgId } : {}),
  };
  return fetch(`${orchBase}${path}`, { ...init, headers, signal: AbortSignal.timeout(12_000) });
}

async function main() {
  try {
    const health = await fetch(`${orchBase}/health`, { signal: AbortSignal.timeout(8000) });
    if (!health.ok) fail(`orchestrator health ${health.status}`);
    else ok("orchestrator /health");
  } catch (e) {
    fail(`orchestrator unreachable — ${e instanceof Error ? e.message : e}`);
  }

  if (!token || !orgId) {
    fail("Set ORCH_SUPER_ADMIN_TOKEN (or ORCH_OWNER_TOKEN) and ERA_HOTEL_ORGANIZATION_ID");
  } else {
    const q = new URLSearchParams({ satelliteKey: "industry_clinic", organizationId: orgId });
    const policyRes = await orchFetch(`/platform/v1/workforce/policy?${q}`);
    if (!policyRes.ok) {
      fail(`workforce policy HTTP ${policyRes.status}`);
    } else {
      const policy = await policyRes.json();
      if (policy.hireMode === "cp_workforce") ok("policy hireMode=cp_workforce");
      else fail(`policy hireMode=${policy.hireMode} (expected cp_workforce)`);
    }

    const empRes = await orchFetch("/platform/v1/workforce/employments");
    if (empRes.status === 401 || empRes.status === 403) {
      fail(`workforce employments auth ${empRes.status}`);
    } else if (!empRes.ok) {
      fail(`workforce employments HTTP ${empRes.status}`);
    } else {
      ok("GET /platform/v1/workforce/employments");
    }
  }

  try {
    const clinicHealth = await fetch(`${clinicBase}/api/health`, { signal: AbortSignal.timeout(8000) });
    if (clinicHealth.ok) ok("clinic /api/health");
    else fail(`clinic health ${clinicHealth.status}`);
  } catch {
    console.log("SKIP clinic health (service down)");
  }

  try {
    const postRes = await fetch(`${clinicBase}/api/admin/practitioners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "SMOKE",
        fullName: "Smoke Test",
        finCode: "1A2B3C4",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (postRes.status === 403) ok("clinic POST practitioners blocked (403)");
    else fail(`clinic POST practitioners expected 403, got ${postRes.status}`);
  } catch {
    console.log("SKIP clinic POST practitioners (clinic down or no session)");
  }

  if (failed > 0) {
    console.error(`\nv3 workforce smoke: ${failed} failure(s)`);
    process.exit(1);
  }
  console.log("\nv3 workforce smoke: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
