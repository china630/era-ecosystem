/**
 * Engineering smoke: SHARED pool self-discovery via orch satellite-pool/members.
 * Uses publicBaseUrl that must match SatelliteEndpoint.baseUrl (not orch public).
 *
 * Opt-in:
 *   ERA_POOL_SELF_URL_SMOKE=1
 *   ORCH_API_URL / ERA_ORCHESTRATOR_INTERNAL_URL
 *   SATELLITE_EVENT_SERVICE_TOKEN (non-folklore)
 *   Optional per sat: ERA_SMOKE_CLINIC_BASE_URL, ERA_SMOKE_HOTEL_BASE_URL,
 *     ERA_SMOKE_FNB_BASE_URL, ERA_SMOKE_AUTO_BASE_URL
 *
 * Exit 0 when gated off. Exit 1 on empty pool / folklore token / HTTP failure.
 */
const folklore = (t) => {
  const s = (t ?? "").trim();
  if (!s || s.length < 16) return true;
  const lower = s.toLowerCase();
  return (
    lower.startsWith("change-me") ||
    lower === "dev-satellite-event-token" ||
    lower === "dev-control-plane-token"
  );
};

function skip(msg) {
  console.log(`[pool-self-url-smoke] SKIP: ${msg}`);
  process.exit(0);
}

function fail(msg) {
  console.error(`[pool-self-url-smoke] FAIL: ${msg}`);
  process.exit(1);
}

async function poolMembers(orchBase, token, satelliteKey, publicBaseUrl) {
  const url = new URL("/v1/internal/satellite-pool/members", orchBase.replace(/\/$/, ""));
  url.searchParams.set("satelliteKey", satelliteKey);
  url.searchParams.set("baseUrl", publicBaseUrl.replace(/\/$/, ""));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

async function main() {
  if (process.env.ERA_POOL_SELF_URL_SMOKE !== "1") {
    skip("ERA_POOL_SELF_URL_SMOKE≠1");
  }
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? "";
  if (folklore(token)) {
    fail("SATELLITE_EVENT_SERVICE_TOKEN missing or folklore (change-me / short / dev-*)");
  }
  const orch =
    process.env.ERA_ORCHESTRATOR_INTERNAL_URL?.trim() ||
    process.env.ORCH_API_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    "";
  if (!orch) fail("ORCH_API_URL / ERA_ORCHESTRATOR_INTERNAL_URL required");

  const targets = [
    ["industry_clinic", process.env.ERA_SMOKE_CLINIC_BASE_URL],
    ["industry_hotel_pms", process.env.ERA_SMOKE_HOTEL_BASE_URL],
    ["industry_fnb_pos", process.env.ERA_SMOKE_FNB_BASE_URL],
    ["industry_auto_service", process.env.ERA_SMOKE_AUTO_BASE_URL],
  ].filter(([, base]) => Boolean(base?.trim()));

  if (targets.length === 0) {
    fail(
      "Set at least one ERA_SMOKE_*_BASE_URL (clinic/hotel/fnb/auto) matching SatelliteEndpoint.baseUrl",
    );
  }

  for (const [satelliteKey, baseUrl] of targets) {
    const { status, body } = await poolMembers(orch, token, satelliteKey, baseUrl);
    if (status === 401 || status === 403) {
      fail(`${satelliteKey}: ${status} (token rejected)`);
    }
    if (status !== 200) {
      fail(`${satelliteKey}: HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`);
    }
    const ids = Array.isArray(body?.organizationIds)
      ? body.organizationIds
      : Array.isArray(body?.organizations)
        ? body.organizations.map((o) => o.id ?? o.organizationId).filter(Boolean)
        : Array.isArray(body)
          ? body
          : [];
    if (ids.length === 0) {
      fail(
        `${satelliteKey}: empty pool for baseUrl=${baseUrl} — check Sync publicBaseUrl = endpoint`,
      );
    }
    console.log(
      `[pool-self-url-smoke] OK ${satelliteKey} orgs=${ids.length} base=${baseUrl}`,
    );
  }
  console.log("[pool-self-url-smoke] PASS");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
