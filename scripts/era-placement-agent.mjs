#!/usr/bin/env node
/**
 * ERA placement host agent.
 *
 * Polls orchestrator for PlacementJob rows in EXPORT/PROVISION, applies
 * curated JSON slice via hotel import-slice when artifact + target URL exist,
 * reports apply log, and leaves SuperAdmin to advance bind/cutover/smoke.
 *
 * Env:
 *   ORCHESTRATOR_URL / CONTROL_PLANE_URL — orch API base
 *   ERA_PLACEMENT_HOST_TOKEN — Bearer (falls back to SATELLITE_EVENT_SERVICE_TOKEN)
 *   ERA_PLACEMENT_TARGET_HOTEL_URL — hotel pool URL for import-slice (optional; else job.targetBaseUrl)
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
const defaultHotelUrl = (
  process.env.ERA_PLACEMENT_TARGET_HOTEL_URL ||
  process.env.ERA_HOTEL_PMS_ORIGIN ||
  ""
).replace(/\/$/, "");

async function reportApplyLog(jobId, applyLog) {
  const res = await fetch(`${base}/v1/placement-agent/jobs/${jobId}/apply-log`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ applyLog }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[era-placement-agent] apply-log failed ${res.status}: ${text}`);
  }
}

async function applyHotelSlice(job) {
  const hotelUrl = (job.targetBaseUrl || defaultHotelUrl || "").replace(/\/$/, "");
  const artifact = job.artifactJson;
  if (!hotelUrl) {
    return "skip: no target hotel URL (set ERA_PLACEMENT_TARGET_HOTEL_URL or job.targetBaseUrl)";
  }
  if (!artifact || typeof artifact !== "object") {
    return "skip: no artifactJson on job (run exportSlice with includeRows first)";
  }
  const slice = {
    organizationId: artifact.organizationId || job.organizationId,
    formatVersion: artifact.formatVersion || 1,
    tables: artifact.tables || [],
    rows: artifact.rows || {},
    note: artifact.note || "hotel curated json slice v1",
  };
  const res = await fetch(`${hotelUrl}/api/internal/v1/placement/import-slice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId: job.organizationId,
      mode: "upsert",
      slice,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return `import-slice FAILED ${res.status}: ${text.slice(0, 500)}`;
  }
  return `import-slice OK ${text.slice(0, 300)}`;
}

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
    console.log(
      `[era-placement-agent] no EXPORT/PROVISION jobs @ ${new Date().toISOString()}`,
    );
    return;
  }
  for (const job of jobs) {
    console.log(
      `[era-placement-agent] job=${job.id} org=${job.organizationId} sat=${job.satelliteKey} ${job.fromTopology}->${job.toTopology} status=${job.status} artifactRef=${job.artifactRef || "-"}`,
    );
    const lines = [];
    lines.push(`status=${job.status}`);
    lines.push(`artifactRef=${job.artifactRef || "none"}`);
    if (
      job.satelliteKey === "industry_hotel_pms" ||
      job.satelliteKey === "industry_hotel"
    ) {
      const result = await applyHotelSlice(job);
      console.log(`  ${result}`);
      lines.push(result);
    } else {
      lines.push(`skip: slice apply not implemented for ${job.satelliteKey}`);
    }
    lines.push(
      `next: SuperAdmin advance markProvisioned → bindAndConfig → cutover → smoke → complete`,
    );
    await reportApplyLog(job.id, lines.join("\n"));
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
