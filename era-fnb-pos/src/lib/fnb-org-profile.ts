import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { DEFAULT_BUSINESS_DAY_START, normalizeBusinessDayStart } from "@/lib/business-day";
import {
  clampFnbPresets,
  defaultFnbPresets,
  fnbSubmodulesMetered,
  normalizeFnbEdition,
  type FnbEdition,
  type FnbPreset,
} from "@/lib/fnb-edition";

export type FnbOrgProfileRow = {
  organizationId: string;
  edition: FnbEdition;
  hotelMode: boolean;
  enabledPresets: FnbPreset[];
  waiterPinPacks: number;
  activeModules: string[];
  businessDayStart: string;
};

const FNB_FALLBACK: Omit<FnbOrgProfileRow, "organizationId"> = {
  edition: "fnb",
  hotelMode: true,
  enabledPresets: defaultFnbPresets("fnb"),
  waiterPinPacks: 1,
  activeModules: [],
  businessDayStart: DEFAULT_BUSINESS_DAY_START,
};

type ProfileDbRow = {
  organizationId: string;
  edition: string;
  hotelMode: boolean;
  enabledPresets: string[];
  waiterPinPacks: number;
  activeModules: string[];
  businessDayStart: string;
};

function toRow(row: ProfileDbRow): FnbOrgProfileRow {
  const edition = normalizeFnbEdition(row.edition);
  return {
    organizationId: row.organizationId,
    edition,
    hotelMode: row.hotelMode,
    enabledPresets: clampFnbPresets(edition, row.enabledPresets),
    waiterPinPacks: row.waiterPinPacks,
    activeModules: row.activeModules,
    businessDayStart: normalizeBusinessDayStart(row.businessDayStart),
  };
}

/**
 * Orchestrator snapshot carries edition and modules only.
 * Hotel mode is set on create and then kept; presets are kept and clamped to the edition.
 */
export async function upsertFnbOrgSnapshot(
  organizationId: string,
  snap: {
    edition?: string;
    activeModules?: string[];
  },
): Promise<FnbOrgProfileRow> {
  const existing = await prisma.fnbOrgProfile.findUnique({
    where: { organizationId },
  });
  const edition = normalizeFnbEdition(snap.edition?.trim() || existing?.edition);
  const kafe = edition === "kafe";
  const activeModules =
    snap.activeModules !== undefined
      ? snap.activeModules
      : (existing?.activeModules ?? []);
  const waiterPinPacks = fnbSubmodulesMetered({ edition, activeModules })
    ? activeModules.includes("fnb_waiter_pin")
      ? 1
      : 0
    : (existing?.waiterPinPacks ?? 1);
  const enabledPresets = clampFnbPresets(edition, existing?.enabledPresets);
  const hotelMode = kafe ? false : (existing?.hotelMode ?? true);
  const row = await prisma.fnbOrgProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      edition,
      hotelMode,
      enabledPresets,
      waiterPinPacks,
      activeModules,
    },
    update: {
      edition,
      hotelMode,
      enabledPresets,
      waiterPinPacks,
      activeModules,
    },
  });
  return toRow(row);
}

export async function getFnbOrgProfile(
  organizationId = requestOrganizationId(),
): Promise<FnbOrgProfileRow> {
  const row = await prisma.fnbOrgProfile.findUnique({
    where: { organizationId },
  });
  if (!row) {
    return { organizationId, ...FNB_FALLBACK, enabledPresets: [...FNB_FALLBACK.enabledPresets] };
  }
  return toRow(row);
}

/** Owner picks which allowed halls run. The edition ceiling is enforced here. */
export async function setFnbEnabledPresets(
  presets: readonly unknown[],
  organizationId = requestOrganizationId(),
): Promise<FnbOrgProfileRow> {
  const current = await getFnbOrgProfile(organizationId);
  const enabledPresets = clampFnbPresets(current.edition, presets);
  const row = await prisma.fnbOrgProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      edition: current.edition,
      hotelMode: current.hotelMode,
      enabledPresets,
    },
    update: { enabledPresets },
  });
  return toRow(row);
}

/** Room charge, in-house guests, BEO, PMS — open only for a hotel department. */
export async function isHotelModeOff(
  organizationId?: string,
): Promise<boolean> {
  const p = await getFnbOrgProfile(organizationId);
  return p.hotelMode === false;
}

export function profileHasModule(
  profile: FnbOrgProfileRow,
  moduleKey: string,
): boolean {
  return profile.activeModules.includes(moduleKey);
}
