import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

type LeadershipItem = {
  id: string;
  globalPersonId: string;
  name: string;
  leadership: boolean;
};

/**
 * Workforce employments live on hub/parent (Sanatorium) when F&B is a commercial
 * DEPARTMENT. Query both self and hub/parent; prefer hub first.
 */
export async function resolveWorkforceOrganizationIds(
  commercialOrganizationId?: string,
): Promise<string[]> {
  const { resolveOperatingMode, resolveSettlementPolicy } = await import(
    "@era/satellite-kit"
  );
  const self =
    commercialOrganizationId?.trim() || requestOrganizationId();
  const [mode, policy] = await Promise.all([
    resolveOperatingMode(self),
    resolveSettlementPolicy(self),
  ]);
  const hub = policy.hubOrganizationId?.trim() || "";
  const parent = mode.parentOrgId?.trim() || "";
  const ordered: string[] = [];
  for (const id of [hub, parent, self]) {
    if (id && !ordered.includes(id)) ordered.push(id);
  }
  return ordered.length ? ordered : [self];
}

async function resolveOrchBaseUrl(fnbOrganizationId: string): Promise<string | null> {
  try {
    const {
      resolveOrchestratorBaseUrl,
      preferInClusterOrchestratorUrl,
      isRunningInsideDocker,
      isPublicOrchestratorUrl,
    } = await import("@era/satellite-kit");
    const fromKit = resolveOrchestratorBaseUrl({ fallback: "" }).trim().replace(
      /\/$/,
      "",
    );
    if (fromKit) return fromKit;

    const {
      getFnbIntegrationSettings,
      normalizePublicOrigin,
    } = await import("@/lib/fnb-integration-settings");
    const fromSettings = normalizePublicOrigin(
      (await getFnbIntegrationSettings(fnbOrganizationId)).orchestratorBaseUrl,
    );
    if (!fromSettings) return null;
    if (isRunningInsideDocker() && isPublicOrchestratorUrl(fromSettings)) {
      return preferInClusterOrchestratorUrl(fromSettings);
    }
    return preferInClusterOrchestratorUrl(fromSettings);
  } catch {
    return null;
  }
}

async function fetchLeadershipForOrg(
  base: string,
  token: string,
  organizationId: string,
): Promise<LeadershipItem[]> {
  const res = await fetch(
    `${base}/internal/v1/workforce/organizations/${encodeURIComponent(organizationId)}/leadership-employments`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw Object.assign(new Error(`workforce leadership ${res.status}`), {
      code: "ORCH_UNAVAILABLE",
    });
  }
  const body = (await res.json().catch(() => null)) as {
    items?: LeadershipItem[];
  } | null;
  return Array.isArray(body?.items) ? body!.items! : [];
}

async function fetchLeadershipFromOrch(
  fnbOrganizationId: string,
): Promise<LeadershipItem[]> {
  const base = await resolveOrchBaseUrl(fnbOrganizationId);
  let token = "";
  try {
    const { resolveSatelliteEventServiceToken } = await import("@era/satellite-kit");
    token = resolveSatelliteEventServiceToken().trim();
  } catch {
    token = "";
  }
  if (!token) {
    token =
      process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
      process.env.INTERNAL_SERVICE_TOKEN?.trim() ||
      "";
  }
  if (!base || !token) {
    throw Object.assign(new Error("Orchestrator workforce unavailable"), {
      code: "ORCH_UNAVAILABLE",
    });
  }

  const orgIds = await resolveWorkforceOrganizationIds(fnbOrganizationId);
  const byId = new Map<string, LeadershipItem>();
  let lastUnavailable: Error | null = null;
  let anyOk = false;
  for (const orgId of orgIds) {
    try {
      const items = await fetchLeadershipForOrg(base, token, orgId);
      anyOk = true;
      for (const item of items) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    } catch (err) {
      lastUnavailable = err as Error;
    }
  }
  if (!anyOk && lastUnavailable) throw lastUnavailable;
  return [...byId.values()];
}

export async function listManagementEaters(outletId?: string | null) {
  const organizationId = requestOrganizationId();
  const rows = await prisma.buffetManagementEater.findMany({
    where: {
      organizationId,
      ...(outletId ? { OR: [{ outletId }, { outletId: null }] } : {}),
    },
    orderBy: [{ included: "desc" }, { displayLabel: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    outletId: r.outletId,
    employmentId: r.employmentId,
    globalPersonId: r.globalPersonId,
    displayLabel: r.displayLabel,
    included: r.included,
    source: r.source,
  }));
}

export async function listIncludedEaters() {
  const organizationId = requestOrganizationId();
  return prisma.buffetManagementEater.findMany({
    where: { organizationId, included: true },
    orderBy: { displayLabel: "asc" },
    select: {
      id: true,
      displayLabel: true,
      employmentId: true,
      globalPersonId: true,
    },
  });
}

export async function syncManagementEatersFromHr(outletId?: string | null) {
  const organizationId = requestOrganizationId();
  const items = await fetchLeadershipFromOrch(organizationId);
  let created = 0;
  let updated = 0;
  for (const item of items) {
    const existing = await prisma.buffetManagementEater.findFirst({
      where: { organizationId, employmentId: item.id },
    });
    if (existing) {
      await prisma.buffetManagementEater.update({
        where: { id: existing.id },
        data: {
          displayLabel: item.name,
          globalPersonId: item.globalPersonId,
          source: "HR",
          ...(outletId ? { outletId } : {}),
        },
      });
      updated += 1;
    } else {
      await prisma.buffetManagementEater.create({
        data: {
          organizationId,
          outletId: outletId ?? null,
          employmentId: item.id,
          globalPersonId: item.globalPersonId,
          displayLabel: item.name,
          included: true,
          source: "HR",
        },
      });
      created += 1;
    }
  }
  return { created, updated, total: items.length, eaters: await listManagementEaters(outletId) };
}

export async function patchManagementEater(
  id: string,
  input: { included?: boolean; displayLabel?: string },
) {
  const organizationId = requestOrganizationId();
  const existing = await prisma.buffetManagementEater.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    throw Object.assign(new Error("EATER_NOT_FOUND"), { code: "EATER_NOT_FOUND" });
  }
  await prisma.buffetManagementEater.update({
    where: { id },
    data: {
      ...(input.included !== undefined ? { included: input.included } : {}),
      ...(input.displayLabel !== undefined
        ? { displayLabel: input.displayLabel.trim() || existing.displayLabel }
        : {}),
    },
  });
  return listManagementEaters();
}

export async function createManualEater(input: {
  displayLabel: string;
  outletId?: string | null;
}) {
  const organizationId = requestOrganizationId();
  const label = input.displayLabel.trim();
  if (!label) {
    throw Object.assign(new Error("LABEL_REQUIRED"), { code: "LABEL_REQUIRED" });
  }
  await prisma.buffetManagementEater.create({
    data: {
      organizationId,
      outletId: input.outletId ?? null,
      displayLabel: label,
      included: true,
      source: "MANUAL",
    },
  });
  return listManagementEaters(input.outletId);
}
