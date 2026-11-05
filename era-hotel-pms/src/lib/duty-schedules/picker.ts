import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "@era/satellite-kit";

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

/**
 * S2S workforce employment picker (org unit + position + leadership).
 * Empty org / token → unavailable; callers must not invent a local staff list.
 */
export async function fetchWorkforcePicker(
  organizationId: string,
): Promise<PickerResult> {
  const orgId = organizationId?.trim() || "";
  const token = resolveSatelliteEventServiceToken().trim();
  const base = resolveOrchestratorBaseUrl({ fallback: "" }).replace(/\/$/, "");
  if (!orgId || orgId === "demo-org" || !token || !base) {
    return { items: [], unavailable: true };
  }
  const url = `${base}/internal/v1/workforce/organizations/${encodeURIComponent(orgId)}/picker`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
        "x-organization-id": orgId,
      },
      cache: "no-store",
    });
  } catch {
    return { items: [], unavailable: true };
  }
  if (!res.ok) return { items: [], unavailable: true };
  const body = (await res.json().catch(() => null)) as {
    items?: Array<Partial<WorkforcePickerItem>>;
  } | null;
  const items: WorkforcePickerItem[] = (body?.items ?? [])
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
