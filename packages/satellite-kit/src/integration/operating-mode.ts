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
