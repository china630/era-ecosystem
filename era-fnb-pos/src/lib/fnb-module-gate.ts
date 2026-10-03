import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
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
export async function requireFnbSatellite(organizationId?: string): Promise<void> {
  const org = organizationId?.trim();
  if (org) {
    await requireSatelliteModule("industry_fnb_pos", { organizationId: org });
    return;
  }
  await requireSatelliteModule("industry_fnb_pos");
}

export async function requireFnbSubmodule(
  moduleKey: string,
  organizationId?: string,
): Promise<void> {
  const profile = await getFnbOrgProfile(organizationId);
  if (!fnbSubmodulesMetered(profile)) {
    return;
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
