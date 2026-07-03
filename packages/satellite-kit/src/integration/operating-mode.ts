import { fetchSubscriptionSnapshot } from "./platform-hook-policy";

export type OrgOperatingMode = "STANDALONE" | "DEPARTMENT";
export type OrgRouting = "OWN" | "PARENT";

export type OperatingModeSnapshot = {
  mode: OrgOperatingMode;
  parentOrgId: string | null;
  fiscalRouting: OrgRouting;
  revenueRouting: OrgRouting;
};

/** Safe default for missing/unknown control-plane data: a standalone org owns
 * its own money. We never silently route to a parent without explicit config. */
export const DEFAULT_OPERATING_MODE: OperatingModeSnapshot = {
  mode: "STANDALONE",
  parentOrgId: null,
  fiscalRouting: "OWN",
  revenueRouting: "OWN",
};

function asMode(v: unknown): OrgOperatingMode {
  return v === "DEPARTMENT" ? "DEPARTMENT" : "STANDALONE";
}

function asRouting(v: unknown): OrgRouting {
  return v === "PARENT" ? "PARENT" : "OWN";
}

/** Parse the `operatingMode` block from a `/v1/subscription/me` snapshot. */
export function parseOperatingMode(
  snapshot: Record<string, unknown> | null,
): OperatingModeSnapshot {
  const block = snapshot?.operatingMode as Record<string, unknown> | undefined;
  if (!block || typeof block !== "object") return { ...DEFAULT_OPERATING_MODE };
  return {
    mode: asMode(block.mode),
    parentOrgId:
      typeof block.parentOrgId === "string" && block.parentOrgId.length > 0
        ? block.parentOrgId
        : null,
    fiscalRouting: asRouting(block.fiscalRouting),
    revenueRouting: asRouting(block.revenueRouting),
  };
}

/** Resolve the operating mode of an organization from the control plane.
 * Falls back to STANDALONE/OWN when the snapshot is unavailable. */
export async function resolveOperatingMode(
  organizationId: string,
): Promise<OperatingModeSnapshot> {
  const snapshot = await fetchSubscriptionSnapshot(organizationId);
  return parseOperatingMode(snapshot);
}

/** True when this org's revenue should be posted to the parent org (e.g. hotel
 * folio) rather than booked under its own VOEN/accounting. */
export function shouldRouteRevenueToParent(mode: OperatingModeSnapshot): boolean {
  return (
    mode.mode === "DEPARTMENT" &&
    mode.revenueRouting === "PARENT" &&
    Boolean(mode.parentOrgId)
  );
}

/** True when fiscalization is owned by the parent (no own KKM receipt here —
 * the fiscal document is issued on the parent's side, avoiding double fiscalization). */
export function shouldFiscalizeOnParent(mode: OperatingModeSnapshot): boolean {
  return (
    mode.mode === "DEPARTMENT" &&
    mode.fiscalRouting === "PARENT" &&
    Boolean(mode.parentOrgId)
  );
}

export type SettlementHubMode = "HOTEL_FRONT_CASH" | "SATELLITE_OWN";
export type PendingSettlementNaPolicy = "BLOCK" | "WARN";

export type SettlementPolicySnapshot = {
  settlementHub: SettlementHubMode;
  pendingSettlementNaPolicy: PendingSettlementNaPolicy;
  hubOrganizationId: string | null;
  deferWalkInToHub: boolean;
};

export const DEFAULT_SETTLEMENT_POLICY: SettlementPolicySnapshot = {
  settlementHub: "SATELLITE_OWN",
  pendingSettlementNaPolicy: "BLOCK",
  hubOrganizationId: null,
  deferWalkInToHub: false,
};

function asSettlementHub(v: unknown): SettlementHubMode {
  return v === "HOTEL_FRONT_CASH" ? "HOTEL_FRONT_CASH" : "SATELLITE_OWN";
}

function asNaPolicy(v: unknown): PendingSettlementNaPolicy {
  return v === "WARN" ? "WARN" : "BLOCK";
}

/** Parse the `settlementPolicy` block from a `/v1/subscription/me` snapshot. */
export function parseSettlementPolicy(
  snapshot: Record<string, unknown> | null,
): SettlementPolicySnapshot {
  const block = snapshot?.settlementPolicy as Record<string, unknown> | undefined;
  if (!block || typeof block !== "object") return { ...DEFAULT_SETTLEMENT_POLICY };
  return {
    settlementHub: asSettlementHub(block.settlementHub),
    pendingSettlementNaPolicy: asNaPolicy(block.pendingSettlementNaPolicy),
    hubOrganizationId:
      typeof block.hubOrganizationId === "string" && block.hubOrganizationId.length > 0
        ? block.hubOrganizationId
        : null,
    deferWalkInToHub: block.deferWalkInToHub === true,
  };
}

/** Resolve settlement hub policy from the control plane. */
export async function resolveSettlementPolicy(
  organizationId: string,
): Promise<SettlementPolicySnapshot> {
  const snapshot = await fetchSubscriptionSnapshot(organizationId);
  return parseSettlementPolicy(snapshot);
}

/** True when walk-in charges from this org must defer to hotel Front Cash. */
export function shouldDeferWalkInToHub(
  policy: SettlementPolicySnapshot,
): boolean {
  return policy.deferWalkInToHub === true;
}
