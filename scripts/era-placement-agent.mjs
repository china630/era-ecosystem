#!/usr/bin/env node
/**
 * ERA placement host agent — clone apply (compose or lab).
 *
 * Polls orchestrator for PlacementJob rows in PROVISION, applies the batch
 * clone recipe (lab dry-run by default, or docker compose up when configured),
 * then report-provision → orch CONFIGURE + autopilot (unless disabled).
 *
 * Env:
 *   ORCHESTRATOR_URL / CONTROL_PLANE_URL — orch API base
 *   ERA_PLACEMENT_HOST_TOKEN — Bearer (falls back to SATELLITE_EVENT_SERVICE_TOKEN)
 *   ERA_PLACEMENT_POLL_MS — poll interval (default 15000); 0 = single poll then exit
 *   ERA_PLACEMENT_CLONE_MODE — lab (default) | compose
 *   ERA_PLACEMENT_COMPOSE_BIN — docker binary (default: docker)
 *   ERA_PLACEMENT_COMPOSE_DIR — where to write compose files (default: os tmp)
 *
 * Production hosts running this agent should set on orchestrator:
 *   ERA_PLACEMENT_INLINE_LAB=0  (avoid double provision with orch inline lab)
 *
 * Usage: node scripts/era-placement-agent.mjs
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
const cloneMode = (
  process.env.ERA_PLACEMENT_CLONE_MODE || "lab"
).trim().toLowerCase();

async function reportProvision(jobId, body) {
  const res = await fetch(
    `${base}/v1/placement-agent/jobs/${jobId}/report-provision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error(
      `[era-placement-agent] report-provision failed ${res.status}: ${text}`,
    );
    return null;
  }
  return res.json();
}

function serviceForJob(job) {
  const recipe = job.recipe && typeof job.recipe === "object" ? job.recipe : null;
  const services = Array.isArray(recipe?.services) ? recipe.services : [];
  return (
    services.find((s) => s.satelliteKey === job.satelliteKey) || {
      satelliteKey: job.satelliteKey,
      serviceName: job.satelliteKey,
      image: `era/${job.satelliteKey}:latest`,
      port: 3200,
      healthPath: "/api/health",
    }
  );
}

async function applyLab(job) {
  const svc = serviceForJob(job);
  const recipe = job.recipe || {};
  const lines = [
    `mode=lab`,
    `batchId=${job.batchId || recipe.batchId || "-"}`,
    `stack=${recipe.stackName || "-"}`,
    `packaging=${job.packaging || recipe.packaging || "-"}`,
    `targetHost=${job.targetHost || recipe.targetHost || "-"}`,
    `service=${svc.serviceName}`,
    `image=${svc.image}`,
    `port=${svc.port}`,
    `healthPath=${svc.healthPath}`,
    `composeYamlBytes=${typeof recipe.composeYaml === "string" ? recipe.composeYaml.length : 0}`,
    `action=dry-run compose up (containers not started)`,
    `healthcheck=simulated ok`,
  ];
  return {
    ok: true,
    applyLog: lines.join("\n"),
    healthSummary: `lab ok ${svc.serviceName}:${svc.port}`,
  };
}

async function applyCompose(job) {
  const svc = serviceForJob(job);
  const recipe = job.recipe || {};
  const bin = process.env.ERA_PLACEMENT_COMPOSE_BIN || "docker";
  const lines = [
    `mode=compose`,
    `service=${svc.serviceName}`,
    `image=${svc.image}`,
    `stack=${recipe.stackName || "-"}`,
  ];

  const probe = spawnSync(bin, ["version"], { encoding: "utf8" });
  lines.push(`docker_version_exit=${probe.status}`);
  if (probe.stdout) lines.push(probe.stdout.trim().slice(0, 500));
  if (probe.status !== 0) {
    lines.push(`error=${(probe.stderr || "docker unavailable").slice(0, 300)}`);
    return {
      ok: false,
      applyLog: lines.join("\n"),
      errorMessage: "compose mode: docker unavailable",
      healthSummary: "docker missing",
    };
  }

  const yaml =
    typeof recipe.composeYaml === "string" && recipe.composeYaml.trim()
      ? recipe.composeYaml
      : null;
  if (!yaml) {
    lines.push("error=composeYaml missing on recipe");
    return {
      ok: false,
      applyLog: lines.join("\n"),
      errorMessage: "composeYaml missing",
      healthSummary: "no yaml",
    };
  }

  const root =
    process.env.ERA_PLACEMENT_COMPOSE_DIR?.trim() ||
    path.join(os.tmpdir(), "era-placement");
  const stackName = recipe.stackName || `era-placement-${job.id.slice(0, 8)}`;
  const dir = path.join(root, stackName);
  fs.mkdirSync(dir, { recursive: true });

  const minFree = Number(process.env.ERA_PLACEMENT_MIN_FREE_BYTES || String(2 * 1024 * 1024 * 1024));
  try {
    if (typeof fs.statfsSync === "function") {
      const st = fs.statfsSync(dir);
      const freeBytes = Number(st.bavail) * Number(st.bsize);
      lines.push(`diskFreeBytes=${freeBytes}`);
      lines.push(`diskMinBytes=${minFree}`);
      if (Number.isFinite(freeBytes) && freeBytes < minFree) {
        return {
          ok: false,
          applyLog: lines.join("\n"),
          errorMessage: `disk free ${freeBytes} < min ${minFree}`,
          healthSummary: "disk precheck failed",
        };
      }
    } else {
      lines.push("diskFreeBytes=unknown (statfs unavailable)");
    }
  } catch (err) {
    lines.push(`diskCheckError=${err instanceof Error ? err.message : String(err)}`);
  }

  const file = path.join(dir, "docker-compose.yml");
  fs.writeFileSync(file, yaml, "utf8");
  lines.push(`composeFile=${file}`);

  const up = spawnSync(
    bin,
    ["compose", "-p", stackName, "-f", file, "up", "-d", "--remove-orphans"],
    { encoding: "utf8", cwd: dir },
  );
  lines.push(`compose_up_exit=${up.status}`);
  if (up.stdout) lines.push(up.stdout.trim().slice(0, 800));
  if (up.stderr) lines.push(up.stderr.trim().slice(0, 800));
  if (up.status !== 0) {
    return {
      ok: false,
      applyLog: lines.join("\n"),
      errorMessage: "docker compose up failed",
      healthSummary: "compose up failed",
    };
  }

  const healthUrl = `http://127.0.0.1:${svc.port}${svc.healthPath}`;
  lines.push(`healthUrl=${healthUrl}`);
  let healthy = false;
  let lastStatus = "n/a";
  for (let i = 0; i < 12; i++) {
    try {
      const res = await fetch(healthUrl);
      lastStatus = String(res.status);
      if (res.ok) {
        healthy = true;
        break;
      }
    } catch {
      lastStatus = "fetch-error";
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  lines.push(`health_status=${lastStatus}`);
  lines.push(`healthcheck=${healthy ? "ok" : "failed"}`);
  if (!healthy) {
    return {
      ok: false,
      applyLog: lines.join("\n"),
      errorMessage: `healthcheck failed for ${svc.serviceName}`,
      healthSummary: `unhealthy ${lastStatus}`,
    };
  }

  return {
    ok: true,
    applyLog: lines.join("\n"),
    healthSummary: `compose ok ${svc.serviceName}:${svc.port}`,
  };
}

async function applyJob(job) {
  if (!job.targetHost && !job.recipe?.targetHost) {
    return {
      ok: false,
      applyLog: "error: targetHost missing on job/recipe",
      errorMessage: "targetHost missing",
      healthSummary: "no host",
    };
  }
  const hint =
    typeof job.recipe?.applyModeHint === "string"
      ? job.recipe.applyModeHint.toLowerCase()
      : cloneMode;
  const mode = cloneMode === "compose" || hint === "compose" ? "compose" : "lab";
  if (mode === "compose") return applyCompose(job);
  return applyLab(job);
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
      `[era-placement-agent] no PROVISION jobs @ ${new Date().toISOString()}`,
    );
    return;
  }
  for (const job of jobs) {
    console.log(
      `[era-placement-agent] job=${job.id} org=${job.organizationId} sat=${job.satelliteKey} mode=${cloneMode} status=${job.status}`,
    );
    const result = await applyJob(job);
    console.log(
      `  report ok=${result.ok} health=${result.healthSummary || "-"}`,
    );
    const updated = await reportProvision(job.id, result);
    if (updated) {
      console.log(`  → status=${updated.status}`);
    }
  }
}

async function main() {
  console.log(
    `[era-placement-agent] orch=${base} pollMs=${pollMs} cloneMode=${cloneMode}`,
  );
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
