import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import {
  parseBuffetCostSettings,
  resolveBuffetCostForOutlet,
  type BuffetCostOrgDefaults,
  type BuffetCostOutletOverride,
  type BuffetCostSettings,
} from "@/lib/buffet-cost-settings";

export async function getBuffetCostSettings(
  organizationId = requestOrganizationId(),
): Promise<BuffetCostSettings> {
  const profile = await getFnbOrgProfile(organizationId);
  const row = await prisma.fnbOrgProfile.findUnique({
    where: { organizationId },
    select: { buffetCostSettingsJson: true },
  });
  const parsed = parseBuffetCostSettings(
    row?.buffetCostSettingsJson ?? null,
    profile.hotelMode,
  );
  const outlets = await prisma.outlet.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const live = new Set(outlets.map((o) => o.id));
  const outletOverrides: BuffetCostSettings["outletOverrides"] = {};
  for (const [id, value] of Object.entries(parsed.outletOverrides)) {
    if (live.has(id)) outletOverrides[id] = value;
  }
  return {
    orgDefaults: parsed.orgDefaults,
    outletOverrides,
    forecastPack: parsed.forecastPack,
  };
}

export async function getEffectiveBuffetCostForOutlet(
  outletId: string | null | undefined,
  organizationId = requestOrganizationId(),
): Promise<BuffetCostOrgDefaults> {
  const settings = await getBuffetCostSettings(organizationId);
  return resolveBuffetCostForOutlet(settings, outletId);
}

export type BuffetCostSettingsPatch = {
  orgDefaults?: Partial<BuffetCostOrgDefaults>;
  /** Set override; pass `null` to clear one outlet. */
  outletOverrides?: Record<string, BuffetCostOutletOverride | null>;
  /** When true, replace the whole outletOverrides map with the provided keys only. */
  replaceOutletOverrides?: boolean;
  /** Replace forecast pack (bands + key SKU norms). */
  forecastPack?: BuffetCostSettings["forecastPack"];
};

export async function patchBuffetCostSettings(
  patch: BuffetCostSettingsPatch,
  organizationId = requestOrganizationId(),
): Promise<BuffetCostSettings> {
  const profile = await getFnbOrgProfile(organizationId);
  const current = await getBuffetCostSettings(organizationId);

  const orgDefaults = {
    ...current.orgDefaults,
    ...(patch.orgDefaults ?? {}),
    stocktakePolicy: {
      ...current.orgDefaults.stocktakePolicy,
      ...(patch.orgDefaults?.stocktakePolicy ?? {}),
    },
  };

  const patchKeys = Object.keys(patch.outletOverrides ?? {});
  if (patchKeys.length > 0) {
    const live = await prisma.outlet.findMany({
      where: { organizationId, id: { in: patchKeys } },
      select: { id: true },
    });
    const liveSet = new Set(live.map((o) => o.id));
    for (const id of patchKeys) {
      const value = patch.outletOverrides![id];
      if (value !== null && !liveSet.has(id)) {
        throw Object.assign(new Error("Outlet not found"), {
          code: "OUTLET_NOT_FOUND",
        });
      }
    }
  }

  let outletOverrides: Record<string, BuffetCostOutletOverride>;
  if (patch.replaceOutletOverrides) {
    outletOverrides = {};
    for (const [id, value] of Object.entries(patch.outletOverrides ?? {})) {
      if (value) outletOverrides[id] = value;
    }
  } else {
    outletOverrides = { ...current.outletOverrides };
    for (const [id, value] of Object.entries(patch.outletOverrides ?? {})) {
      if (value === null) {
        delete outletOverrides[id];
      } else if (value) {
        outletOverrides[id] = { ...outletOverrides[id], ...value };
      }
    }
  }

  const forecastPackPatch = patch.forecastPack
    ? {
        keySkuNorms:
          patch.forecastPack.keySkuNorms ?? current.forecastPack.keySkuNorms,
        bands: patch.forecastPack.bands ?? current.forecastPack.bands,
      }
    : current.forecastPack;

  const normalized = parseBuffetCostSettings(
    {
      orgDefaults,
      outletOverrides,
      forecastPack: forecastPackPatch,
    },
    profile.hotelMode,
  );

  await prisma.fnbOrgProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      edition: profile.edition,
      hotelMode: profile.hotelMode,
      enabledPresets: profile.enabledPresets,
      waiterPinPacks: profile.waiterPinPacks,
      activeModules: profile.activeModules,
      businessDayStart: profile.businessDayStart,
      buffetCostSettingsJson: normalized,
    },
    update: { buffetCostSettingsJson: normalized },
  });

  return normalized;
}
