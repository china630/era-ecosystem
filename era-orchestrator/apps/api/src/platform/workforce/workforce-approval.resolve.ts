export type OrgUnitNode = {
  id: string;
  parentId: string | null;
  name: string;
  managerEmploymentId: string | null;
  managerUserId: string | null;
};

export type ResolvedAssignee = {
  employmentId: string | null;
  userId: string | null;
  orgUnitId: string;
  orgUnitName: string;
};

/**
 * Manager of the requester's unit. If that manager is the requester, or the
 * unit has no manager, walk to the parent. Never returns a person by name.
 */
export function resolveRequesterManager(input: {
  startOrgUnitId: string;
  requesterEmploymentId: string;
  units: OrgUnitNode[];
}): ResolvedAssignee | null {
  const byId = new Map(input.units.map((u) => [u.id, u]));
  let current = byId.get(input.startOrgUnitId) ?? null;
  for (let guard = 0; current && guard < 24; guard += 1) {
    const managerId = current.managerEmploymentId;
    if (managerId && managerId !== input.requesterEmploymentId) {
      return {
        employmentId: managerId,
        userId: current.managerUserId,
        orgUnitId: current.id,
        orgUnitName: current.name,
      };
    }
    if (!managerId && current.managerUserId) {
      return {
        employmentId: null,
        userId: current.managerUserId,
        orgUnitId: current.id,
        orgUnitName: current.name,
      };
    }
    current = current.parentId ? (byId.get(current.parentId) ?? null) : null;
  }
  return null;
}
