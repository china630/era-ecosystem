import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

type LeadershipItem = {
  id: string;
  globalPersonId: string;
  name: string;
  leadership: boolean;
};

async function fetchLeadershipFromOrch(
  organizationId: string,
): Promise<LeadershipItem[]> {
  const base =
    process.env.ORCHESTRATOR_INTERNAL_URL?.replace(/\/$/, "") ||
    process.env.ERA_ORCHESTRATOR_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_ORCHESTRATOR_URL?.replace(/\/$/, "");
  const token =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.INTERNAL_SERVICE_TOKEN?.trim() ||
    "";
  if (!base || !token) {
    throw Object.assign(new Error("Orchestrator workforce unavailable"), {
      code: "ORCH_UNAVAILABLE",
    });
  }
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
