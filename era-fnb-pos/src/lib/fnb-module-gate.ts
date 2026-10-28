import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
  fetchSubscriptionSnapshot,
  resolveEntitlementActiveModules,
} from "@era/satellite-kit";
import { getFnbOrgProfile, isHotelModeOff } from "@/lib/fnb-org-profile";
import { fnbSubmodulesMetered } from "@/lib/fnb-edition";

export { IndustryModuleInactiveError };

export class FnbHotelModeError extends Error {
  readonly status = 403;
  readonly code = "FNB_HOTEL_MODE_OFF";
  constructor(feature: string) {
    super(`Hotel F&B feature is off for this organization: ${feature}`);
    this.name = "FnbHotelModeError";
  }
}

export class FnbSubmoduleInactiveError extends Error {
  readonly status = 403;
  readonly code = "FNB_SUBMODULE_INACTIVE";
  constructor(public readonly moduleKey: string) {
    super(`F&B module not active: ${moduleKey}`);
    this.name = "FnbSubmoduleInactiveError";
  }
}

export class FnbQuotaError extends Error {
  readonly status = 429;
  readonly code = "FNB_QUOTA";
  constructor(message: string) {
    super(message);
    this.name = "FnbQuotaError";
  }
}

/** F&B satellite gate. Submodules (KDS, Zal, QR) are checked separately. */
export async function requireFnbSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_fnb_pos");
  await requireSatelliteModule("industry_fnb_pos", { organizationId: org });
}

/**
 * Submodule gate: live CP subscription snapshot first (same SoT as industry
 * entitlements), then local `fnbOrgProfile` after Sync (air-gap).
 */
export async function requireFnbSubmodule(
  moduleKey: string,
  organizationId?: string,
): Promise<void> {
  const profile = await getFnbOrgProfile(organizationId);
  if (!fnbSubmodulesMetered(profile)) {
    return;
  }
  const org = (organizationId ?? profile.organizationId)?.trim();
  if (org) {
    try {
      const snap = await fetchSubscriptionSnapshot(org);
      // Only trust CP when the snapshot actually carries `activeModules`
      // (partial bodies must not wipe a healthy local profile).
      if (snap && Array.isArray(snap.activeModules)) {
        const fromCp = resolveEntitlementActiveModules(snap) ?? [];
        if (!fromCp.includes(moduleKey)) {
          throw new FnbSubmoduleInactiveError(moduleKey);
        }
        return;
      }
    } catch (err) {
      if (err instanceof FnbSubmoduleInactiveError) throw err;
      /* CP unreachable — fall through to local profile */
    }
  }
  if (!profile.activeModules.includes(moduleKey)) {
    throw new FnbSubmoduleInactiveError(moduleKey);
  }
}

export async function assertHotelFnbFeature(feature: string): Promise<void> {
  if (await isHotelModeOff()) {
    throw new FnbHotelModeError(feature);
  }
}
