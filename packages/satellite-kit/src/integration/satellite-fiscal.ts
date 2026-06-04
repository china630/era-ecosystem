import { fiscalize, type FiscalizeInput, type FiscalizeResult } from "@era/fiscal";
import { satelliteOrganizationId } from "../orchestrator-gateway";
import {
  resolveOperatingMode,
  shouldFiscalizeOnParent,
} from "./operating-mode";

export type SatelliteFiscalizeSkipped = {
  skipped: true;
  reason: "parent_fiscal";
  parentOrgId: string;
};

export type SatelliteFiscalizeOutcome = FiscalizeResult | SatelliteFiscalizeSkipped;

const CASH_LIKE = new Set(["cash", "card", "CASH", "CARD"]);

/** Issue a KKM receipt on this satellite, unless the org routes fiscalization to
 * a parent (hotel) — avoids double fiscalization for department deployments. */
export async function fiscalizeForSatellite(
  input: FiscalizeInput,
  organizationId?: string,
): Promise<SatelliteFiscalizeOutcome> {
  const orgId = organizationId?.trim() || satelliteOrganizationId();
  const mode = await resolveOperatingMode(orgId);
  if (shouldFiscalizeOnParent(mode)) {
    return {
      skipped: true,
      reason: "parent_fiscal",
      parentOrgId: mode.parentOrgId!,
    };
  }
  return fiscalize(input);
}

/** Whether this payment method should trigger local KKM fiscalization. */
export function isFiscalPaymentMethod(method: string): boolean {
  return CASH_LIKE.has(method.trim());
}

export function isFiscalSkipped(
  outcome: SatelliteFiscalizeOutcome,
): outcome is SatelliteFiscalizeSkipped {
  return "skipped" in outcome && outcome.skipped === true;
}
