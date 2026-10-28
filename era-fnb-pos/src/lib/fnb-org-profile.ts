import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { DEFAULT_BUSINESS_DAY_START, normalizeBusinessDayStart } from "@/lib/business-day";
import {
  clampFnbPresets,
  defaultFnbPresets,
  normalizeFnbEdition,
} from "@/lib/fnb-edition";
import {
  upsertFnbOrgSnapshot,
  type FnbOrgProfileRow,
} from "@/lib/fnb-org-snapshot";

export type { FnbOrgProfileRow };
export { upsertFnbOrgSnapshot };

const FNB_FALLBACK: Omit<FnbOrgProfileRow, "organizationId"> = {
  edition: "fnb",
  hotelMode: true,
  enabledPresets: defaultFnbPresets("fnb"),
  waiterPinPacks: 1,
  activeModules: [],
  businessDayStart: DEFAULT_BUSINESS_DAY_START,
};

function toRow(row: {
  organizationId: string;
  edition: string;
  hotelMode: boolean;
  enabledPresets: string[];
  waiterPinPacks: number;
  activeModules: string[];
  businessDayStart: string;
}): FnbOrgProfileRow {
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
