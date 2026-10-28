/**
 * CP-ORG-PROFILE-01 Track C — receipt chrome from orch orgProfile + outlet overlay.
 */
import {
  getCachedOrgProfile,
  resolvePrintContacts,
  type OutletContactOverlay,
} from "@era/satellite-kit";
import { satelliteOrganizationId } from "@era/satellite-kit";
import { outletToPrintOverlay } from "@/lib/org-print-overlay";

export { outletToPrintOverlay };

export type FnbReceiptChrome = ReturnType<typeof resolvePrintContacts> & {
  hasOrgProfile: boolean;
};

export function resolveFnbPrintContacts(
  outlet?: OutletContactOverlay | null,
): FnbReceiptChrome {
  const orgId = (() => {
    try {
      return satelliteOrganizationId();
    } catch {
      return null;
    }
  })();
  const snap = orgId ? getCachedOrgProfile(orgId) : getCachedOrgProfile();
  return {
    ...resolvePrintContacts({ org: snap, outlet: outlet ?? null }),
    hasOrgProfile: Boolean(snap),
  };
}
