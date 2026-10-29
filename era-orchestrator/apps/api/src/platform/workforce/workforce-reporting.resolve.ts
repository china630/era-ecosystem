export type OrgUnitNode = {
  id: string;
  parentId: string | null;
  name: string;
  managerEmploymentId: string | null;
  managerUserId: string | null;
};

export type EmploymentNode = {
  id: string;
  orgUnitId: string;
  status: string;
  managerEmploymentId: string | null;
  matrixManagerEmploymentId: string | null;
  platformUserId: string | null;
};

export type ResolvedAssignee = {
  employmentId: string | null;
  userId: string | null;
  orgUnitId: string;
  orgUnitName: string;
};

/** Skip a step whose audience does not match the requester position. */
export function stepApplies(
  audience: string | null | undefined,
  leadership: boolean,
): boolean {
  if (!audience || audience === "ALWAYS") return true;
  if (audience === "LEADERSHIP") return leadership;
  if (audience === "ORDINARY") return !leadership;
  return true;
}

/**
 * Line manager: employment solid override → unit manager walk (skip self).
 * Never returns a person by name. Terminated override is ignored.
 */
export function resolveLineManager(input: {
  employment: EmploymentNode;
  units: OrgUnitNode[];
  employmentsById: Map<string, EmploymentNode>;
}): ResolvedAssignee | null {
  const overrideId = input.employment.managerEmploymentId;
  if (overrideId && overrideId !== input.employment.id) {
    const mgr = input.employmentsById.get(overrideId);
    if (mgr && mgr.status === "ACTIVE") {
      const unit =
        input.units.find((u) => u.id === mgr.orgUnitId) ??
        input.units.find((u) => u.id === input.employment.orgUnitId);
      return {
        employmentId: mgr.id,
        userId: mgr.platformUserId,
        orgUnitId: unit?.id ?? mgr.orgUnitId,
        orgUnitName: unit?.name ?? "",
      };
    }
  }
  return resolveUnitManagerWalk({
    startOrgUnitId: input.employment.orgUnitId,
    requesterEmploymentId: input.employment.id,
    units: input.units,
  });
}

/** Unit manager only (ORG_UNIT_HEAD) — no employment override. */
export function resolveUnitManagerWalk(input: {
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

/** @deprecated Use resolveUnitManagerWalk or resolveLineManager. */
export function resolveRequesterManager(input: {
  startOrgUnitId: string;
  requesterEmploymentId: string;
  units: OrgUnitNode[];
}): ResolvedAssignee | null {
  return resolveUnitManagerWalk(input);
}

export function resolveManagerChain(input: {
  employment: EmploymentNode;
  units: OrgUnitNode[];
  employmentsById: Map<string, EmploymentNode>;
  chainOffset: number;
}): ResolvedAssignee | null {
  const hops = Math.max(1, Math.min(24, Math.floor(input.chainOffset) || 2));
  let current: EmploymentNode | null = input.employment;
  let last: ResolvedAssignee | null = null;
  for (let i = 0; i < hops; i += 1) {
    if (!current) return null;
    last = resolveLineManager({
      employment: current,
      units: input.units,
      employmentsById: input.employmentsById,
    });
    if (!last?.employmentId) return last;
    current = input.employmentsById.get(last.employmentId) ?? null;
  }
  return last;
}

export function resolveMatrixManager(input: {
  employment: EmploymentNode;
  units: OrgUnitNode[];
  employmentsById: Map<string, EmploymentNode>;
}): ResolvedAssignee | null {
  const mid = input.employment.matrixManagerEmploymentId;
  if (!mid || mid === input.employment.id) return null;
  const mgr = input.employmentsById.get(mid);
  if (!mgr || mgr.status !== "ACTIVE") return null;
  const unit =
    input.units.find((u) => u.id === mgr.orgUnitId) ??
    input.units.find((u) => u.id === input.employment.orgUnitId);
  return {
    employmentId: mgr.id,
    userId: mgr.platformUserId,
    orgUnitId: unit?.id ?? mgr.orgUnitId,
    orgUnitName: unit?.name ?? "",
  };
}
