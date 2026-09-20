import {
  fiscalize,
  saleForSatellite,
  refundForSatellite,
  voidForSatellite,
  listDevices,
  resolveDefaultDevices,
  FiscalError,
  FISCAL_ERROR,
  type FiscalizeInput,
  type FiscalizeResult,
  type SaleInput,
  type SaleForSatelliteOutcome,
  type SaleResult,
  type FiscalContext,
  type FiscalDeviceKind,
  type FiscalDeviceRef,
  type RefundInput,
  type VoidInput,
} from "@era/fiscal";
import { satelliteOrganizationId } from "../orchestrator-gateway";
import {
  resolveOperatingMode,
  shouldFiscalizeOnParent,
} from "./operating-mode";

export type SatelliteFiscalizeSkipped = {
  skipped: true;
  reason: "parent_fiscal" | "recorded_no_device";
  parentOrgId?: string;
};

export type SatelliteFiscalizeOutcome =
  | FiscalizeResult
  | SaleResult
  | SatelliteFiscalizeSkipped;

const CASH_LIKE = new Set(["cash", "card", "CASH", "CARD"]);

async function skipIfParent(
  organizationId: string,
): Promise<SatelliteFiscalizeSkipped | null> {
  const mode = await resolveOperatingMode(organizationId);
  if (shouldFiscalizeOnParent(mode)) {
    return {
      skipped: true,
      reason: "parent_fiscal",
      parentOrgId: mode.parentOrgId!,
    };
  }
  return null;
}

/** Issue a KKM receipt on this satellite, unless the org routes fiscalization to
 * a parent (hotel) — avoids double fiscalization for department deployments. */
export async function fiscalizeForSatellite(
  input: FiscalizeInput,
  organizationId?: string,
): Promise<SatelliteFiscalizeOutcome> {
  const orgId = organizationId?.trim() || satelliteOrganizationId();
  const parent = await skipIfParent(orgId);
  if (parent) return parent;
  const withOrg: FiscalizeInput = { ...input, organizationId: orgId };
  return fiscalize(withOrg);
}

/** Full sale path with lines + device defaults (F0+). */
export async function saleForSatelliteRouted(
  input: Omit<SaleInput, "organizationId"> & { organizationId?: string },
): Promise<SaleForSatelliteOutcome | SatelliteFiscalizeSkipped> {
  const orgId = input.organizationId?.trim() || satelliteOrganizationId();
  const parent = await skipIfParent(orgId);
  if (parent) return parent;
  return saleForSatellite({ ...input, organizationId: orgId });
}

export async function refundForSatelliteRouted(
  input: Omit<RefundInput, "organizationId"> & { organizationId?: string },
): Promise<SaleForSatelliteOutcome | SatelliteFiscalizeSkipped> {
  const orgId = input.organizationId?.trim() || satelliteOrganizationId();
  const parent = await skipIfParent(orgId);
  if (parent) return parent;
  return refundForSatellite({ ...input, organizationId: orgId });
}

export async function voidForSatelliteRouted(
  input: Omit<VoidInput, "organizationId"> & { organizationId?: string },
): Promise<SaleForSatelliteOutcome | SatelliteFiscalizeSkipped> {
  const orgId = input.organizationId?.trim() || satelliteOrganizationId();
  const parent = await skipIfParent(orgId);
  if (parent) return parent;
  return voidForSatellite({ ...input, organizationId: orgId });
}

export function listDevicesForSatellite(
  ctx: Omit<FiscalContext, "organizationId"> & {
    organizationId?: string;
    kind?: FiscalDeviceKind;
  },
): FiscalDeviceRef[] {
  const organizationId = ctx.organizationId?.trim() || satelliteOrganizationId();
  return listDevices({ ...ctx, organizationId });
}

export function resolveDefaultDevicesForSatellite(
  ctx: Omit<FiscalContext, "organizationId"> & {
    organizationId?: string;
    fiscalDeviceId?: string;
    bankTerminalId?: string;
    requireFiscal?: boolean;
    requireBank?: boolean;
  },
) {
  const organizationId = ctx.organizationId?.trim() || satelliteOrganizationId();
  return resolveDefaultDevices({ ...ctx, organizationId });
}

/** ERA_FISCAL_LIVE: refuse ops when the org catalog has no KKM. */
export function assertLiveFiscalReady(ctx: {
  organizationId?: string;
  outletCode?: string;
  registerRef?: string;
}): void {
  if (process.env.ERA_FISCAL_LIVE !== "true") return;
  const organizationId = ctx.organizationId?.trim() || satelliteOrganizationId();
  const kkms = listDevices({
    organizationId,
    outletCode: ctx.outletCode,
    registerRef: ctx.registerRef,
    kind: "FISCAL_KKM",
  });
  if (kkms.length === 0) {
    throw new FiscalError(
      FISCAL_ERROR.LIVE_DEVICE_REQUIRED,
      "Live fiscal required: add a KKM in Super-Admin before this operation",
    );
  }
}

/** Whether this payment method should trigger local KKM fiscalization. */
export function isFiscalPaymentMethod(method: string): boolean {
  return CASH_LIKE.has(method.trim());
}

export function isFiscalSkipped(
  outcome: SatelliteFiscalizeOutcome | SaleForSatelliteOutcome,
): outcome is SatelliteFiscalizeSkipped | { skipped: true; reason: "recorded_no_device" } {
  return "skipped" in outcome && outcome.skipped === true;
}

export { FiscalError, FISCAL_ERROR };
