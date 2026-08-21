#!/usr/bin/env node
/**
 * ERA placement host agent (GitOps stub).
 *
 * Polls orchestrator for PlacementJob rows in PENDING/PROVISION and logs
 * apply steps. Does NOT SSH from orchestrator — real apply is host-side
 * (compose pull, migrate, bind). See docs/adr/deployment-topology.md §4–§5.
 *
 * Env:
 *   ORCHESTRATOR_URL / CONTROL_PLANE_URL — orch API base (default http://127.0.0.1:4000)
 *   ERA_PLACEMENT_HOST_TOKEN — Bearer (falls back to SATELLITE_EVENT_SERVICE_TOKEN)
 *   ERA_PLACEMENT_POLL_MS — poll interval (default 15000); 0 = single poll then exit
 *
 * Usage: node scripts/era-placement-agent.mjs
 */

const base = (
  process.env.ORCHESTRATOR_URL ||
  process.env.CONTROL_PLANE_URL ||
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

const token =
  process.env.ERA_PLACEMENT_HOST_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
  "";

const pollMs = Number(process.env.ERA_PLACEMENT_POLL_MS ?? "15000");

async function pollOnce() {
  if (!token) {
    console.error(
      "[era-placement-agent] Missing ERA_PLACEMENT_HOST_TOKEN or SATELLITE_EVENT_SERVICE_TOKEN",
    );
    process.exitCode = 1;
    return;
  }
  const res = await fetch(`${base}/v1/placement-agent/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[era-placement-agent] poll failed ${res.status}: ${text}`);
    return;
  }
  const jobs = await res.json();
  if (!Array.isArray(jobs) || jobs.length === 0) {
    console.log(`[era-placement-agent] no PENDING/PROVISION jobs @ ${new Date().toISOString()}`);
    return;
  }
  for (const job of jobs) {
    console.log(
      `[era-placement-agent] job=${job.id} org=${job.organizationId} sat=${job.satelliteKey} ${job.fromTopology}->${job.toTopology} status=${job.status}`,
    );
    console.log(
      `  apply steps (host-side stub): provision stack → restore/slice → bind+runtime-config → cutover SatelliteEndpoint → smoke`,
    );
    console.log(
      `  note: orch does not SSH; advance via POST /v1/admin/placement-jobs/${job.id}/advance after local apply`,
    );
  }
}

async function main() {
  console.log(`[era-placement-agent] orch=${base} pollMs=${pollMs}`);
  await pollOnce();
  if (pollMs > 0) {
    setInterval(() => {
      pollOnce().catch((err) => console.error(err));
    }, pollMs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
