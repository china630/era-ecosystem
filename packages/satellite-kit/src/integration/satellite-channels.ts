import { fetchSubscriptionSnapshot } from "./platform-hook-policy";
import {
  resolveOperatingMode,
  shouldRouteRevenueToParent,
} from "./operating-mode";

export type SatelliteChannelKind =
  | "FOLIO_POST"
  | "SETTLEMENT"
  | "REVENUE_EVENT"
  | "READ_STATUS"
  | "OPS_HANDOFF";

/** Acceptor satellite key for revenue spine edges. */
export const CHANNEL_FINANCE_SATELLITE_KEY = "finance_core";

export type SatelliteChannelSnapshotRow = {
  id?: string;
  fromOrgId: string;
  fromSatelliteKey: string;
  toOrgId: string;
  toSatelliteKey: string;
  kind: string;
  enabled: boolean;
  managedBy?: string;
};

export function parseChannels(
  snapshot: Record<string, unknown> | null,
): SatelliteChannelSnapshotRow[] {
  const raw = snapshot?.channels;
  if (!Array.isArray(raw)) return [];
  const out: SatelliteChannelSnapshotRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (
      typeof o.fromOrgId !== "string" ||
      typeof o.fromSatelliteKey !== "string" ||
      typeof o.toOrgId !== "string" ||
      typeof o.toSatelliteKey !== "string" ||
      typeof o.kind !== "string"
    ) {
      continue;
    }
    out.push({
      id: typeof o.id === "string" ? o.id : undefined,
      fromOrgId: o.fromOrgId,
      fromSatelliteKey: o.fromSatelliteKey,
      toOrgId: o.toOrgId,
      toSatelliteKey: o.toSatelliteKey,
      kind: o.kind,
      enabled: o.enabled === true,
      managedBy: typeof o.managedBy === "string" ? o.managedBy : undefined,
    });
  }
  return out;
}

/** True only when a matching enabled DB channel exists in the snapshot. */
export function isChannelEnabled(
  snapshot: Record<string, unknown> | null,
  query: {
    fromOrgId: string;
    fromSatelliteKey: string;
    toOrgId: string;
    toSatelliteKey: string;
    kind: SatelliteChannelKind | string;
  },
): boolean {
  return parseChannels(snapshot).some(
    (c) =>
      c.enabled &&
      c.fromOrgId === query.fromOrgId &&
      c.fromSatelliteKey === query.fromSatelliteKey &&
      c.toOrgId === query.toOrgId &&
      c.toSatelliteKey === query.toSatelliteKey &&
      c.kind === query.kind,
  );
}

export async function assertChannelEnabled(input: {
  organizationId: string;
  fromOrgId: string;
  fromSatelliteKey: string;
  toOrgId: string;
  toSatelliteKey: string;
  kind: SatelliteChannelKind | string;
}): Promise<boolean> {
  const snapshot = await fetchSubscriptionSnapshot(input.organizationId);
  return isChannelEnabled(snapshot, input);
}

/**
 * Live CP check (service token). Fail-closed when orch unreachable or disabled/missing.
 */
export async function checkChannelEnabledLive(input: {
  fromOrgId: string;
  fromSatelliteKey: string;
  toOrgId: string;
  toSatelliteKey: string;
  kind: SatelliteChannelKind | string;
}): Promise<boolean> {
  const base = (
    process.env.ORCHESTRATOR_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const token =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    "";
  if (!base || !token) return false;
  const q = new URLSearchParams({
    fromOrgId: input.fromOrgId,
    fromSatelliteKey: input.fromSatelliteKey,
    toOrgId: input.toOrgId,
    toSatelliteKey: input.toSatelliteKey,
    kind: String(input.kind),
  });
  const res = await fetch(`${base}/v1/internal/channels/check?${q}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
    },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return false;
  const body = (await res.json().catch(() => null)) as { enabled?: boolean } | null;
  return body?.enabled === true;
}

export class SatelliteChannelDisabledError extends Error {
  readonly code = "SATELLITE_CHANNEL_DISABLED";
  constructor(kind: string) {
    super(`Integration channel ${kind} is disabled or missing`);
    this.name = "SatelliteChannelDisabledError";
  }
}

/**
 * Money event types that must pass REVENUE_EVENT channel before orch publish.
 * Unknown types skip the live check (guest / stock / status stay ungated here).
 */
export const REVENUE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED",
  "SATELLITE_HOTEL_INVOICE_ISSUED",
  "SATELLITE_HOTEL_RESERVATION_COMPLETED",
  "SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT",
  "SATELLITE_HOTEL_AGENCY_COMMISSION_PAYABLE",
  "SATELLITE_CLINIC_VISIT_COMPLETED",
  "SATELLITE_CLINIC_PROCEDURE_COMPLETED",
  "SATELLITE_CLINIC_LAB_ORDER_COMPLETED",
  "SATELLITE_CLINIC_WARD_DAY_CHARGE",
  "SATELLITE_FB_SALE_COMPLETED",
  "SATELLITE_FB_SHIFT_CLOSED",
  "SATELLITE_RETAIL_SALE_COMPLETED",
  "SATELLITE_RETAIL_SHIFT_CLOSED",
]);

/**
 * Fail-closed gate for money publishes to finance_core.
 * Resolves parent when department revenueRouting=PARENT; otherwise same org.
 * Does not wrap guest-status or stock events — call only from revenue dispatch sites.
 */
export async function assertRevenueEventChannelEnabled(input: {
  organizationId: string;
  fromSatelliteKey: string;
}): Promise<void> {
  const orgId = input.organizationId.trim();
  const fromKey = input.fromSatelliteKey.trim();
  if (!orgId || !fromKey) {
    throw new SatelliteChannelDisabledError("REVENUE_EVENT");
  }
  const mode = await resolveOperatingMode(orgId);
  const toOrgId =
    shouldRouteRevenueToParent(mode) && mode.parentOrgId
      ? mode.parentOrgId
      : orgId;
  const ok = await checkChannelEnabledLive({
    fromOrgId: orgId,
    fromSatelliteKey: fromKey,
    toOrgId,
    toSatelliteKey: CHANNEL_FINANCE_SATELLITE_KEY,
    kind: "REVENUE_EVENT",
  });
  if (!ok) {
    throw new SatelliteChannelDisabledError("REVENUE_EVENT");
  }
}

/**
 * Unified money-event gate: no-op for unknown types; otherwise assertRevenueEventChannelEnabled.
 */
export async function assertRevenueEventForPublish(input: {
  organizationId: string;
  fromSatelliteKey: string;
  eventType: string;
}): Promise<void> {
  if (!REVENUE_EVENT_TYPES.has(input.eventType)) return;
  await assertRevenueEventChannelEnabled({
    organizationId: input.organizationId,
    fromSatelliteKey: input.fromSatelliteKey,
  });
}
