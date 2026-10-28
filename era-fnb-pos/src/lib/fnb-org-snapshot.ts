import { prisma } from "@/lib/prisma";
import { normalizeBusinessDayStart } from "@/lib/business-day";
import {
  clampFnbPresets,
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

/**
 * Boot/instrumentation-safe upsert — no `@/lib/request-organization`
 * (avoids pulling the satellite-kit barrel / Node crypto into Next instrumentation).
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
