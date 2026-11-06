import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "@era/satellite-kit";
import { resolveWorkforceOrganizationIds } from "@/lib/buffet-management-eaters.service";

export type WorkforcePickerItem = {
  id: string;
  globalPersonId: string;
  name: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
  positionId: string | null;
  positionName: string | null;
  leadership: boolean;
};

export type PickerResult = {
  items: WorkforcePickerItem[];
  unavailable: boolean;
};

async function fetchPickerForOrg(
  base: string,
  token: string,
  organizationId: string,
): Promise<WorkforcePickerItem[]> {
  const url = `${base}/internal/v1/workforce/organizations/${encodeURIComponent(organizationId)}/picker`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
      "x-organization-id": organizationId,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw Object.assign(new Error(`picker ${res.status}`), {
      code: "ORCH_UNAVAILABLE",
    });
  }
  const body = (await res.json().catch(() => null)) as {
    items?: Array<Partial<WorkforcePickerItem>>;
  } | null;
  return (body?.items ?? [])
    .filter((row) => row.globalPersonId && row.name)
    .map((row) => ({
      id: String(row.id ?? row.globalPersonId),
      globalPersonId: String(row.globalPersonId),
      name: String(row.name).trim(),
      orgUnitId: row.orgUnitId?.trim() || null,
      orgUnitName: row.orgUnitName?.trim() || null,
      positionId: row.positionId?.trim() || null,
      positionName: row.positionName?.trim() || null,
      leadership: row.leadership === true,
    }));
}

/** Prefer hub/parent workforce org (same as buffet leadership), then self. */
export async function fetchWorkforcePicker(
  fnbOrganizationId: string,
): Promise<PickerResult> {
  const token = resolveSatelliteEventServiceToken().trim();
  const base = resolveOrchestratorBaseUrl({ fallback: "" }).replace(/\/$/, "");
  if (!fnbOrganizationId.trim() || !token || !base) {
    return { items: [], unavailable: true };
  }
  const orgIds = await resolveWorkforceOrganizationIds(fnbOrganizationId);
  const seen = new Set<string>();
  const items: WorkforcePickerItem[] = [];
  let anyOk = false;
  for (const orgId of orgIds) {
    try {
      const rows = await fetchPickerForOrg(base, token, orgId);
      anyOk = true;
      for (const row of rows) {
        if (seen.has(row.globalPersonId)) continue;
        seen.add(row.globalPersonId);
        items.push(row);
      }
    } catch {
      /* try next org */
    }
  }
  if (!anyOk) return { items: [], unavailable: true };
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { items, unavailable: false };
}

export function filterPickerByBinding(
  items: WorkforcePickerItem[],
  binding: { orgUnitIds: string[]; positionIds: string[] },
  selectedOrgUnitIds?: string[],
): WorkforcePickerItem[] {
  const units =
    selectedOrgUnitIds && selectedOrgUnitIds.length > 0
      ? selectedOrgUnitIds
      : binding.orgUnitIds;
  const positions = binding.positionIds;
  return items.filter((item) => {
    if (units.length > 0) {
      if (!item.orgUnitId || !units.includes(item.orgUnitId)) return false;
    }
    if (positions.length > 0) {
      if (!item.positionId || !positions.includes(item.positionId)) return false;
    }
    return true;
  });
}
