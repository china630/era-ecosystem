/**
 * CP-ORG-PROFILE-01 — resolve receipt chrome from orch snapshot + outlet overlay.
 */
import {
  getCachedOrgProfile,
  resolvePrintContacts,
  type OutletContactOverlay,
} from "@era/satellite-kit";
import { satelliteOrganizationId } from "@era/satellite-kit";

export function resolveFnbPrintContacts(outlet?: OutletContactOverlay | null) {
  const orgId = (() => {
    try {
      return satelliteOrganizationId();
    } catch {
      return null;
    }
  })();
  const snap = orgId ? getCachedOrgProfile(orgId) : getCachedOrgProfile();
  return resolvePrintContacts({ org: snap, outlet: outlet ?? null });
}
