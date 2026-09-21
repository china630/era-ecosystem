import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

export type FnbOrgProfileRow = {
  organizationId: string;
  edition: string;
  hotelMode: boolean;
  waiterPinPacks: number;
  activeModules: string[];
};

const HOTEL_FALLBACK: Omit<FnbOrgProfileRow, "organizationId"> = {
  edition: "hotel",
  hotelMode: true,
  waiterPinPacks: 1,
  activeModules: [],
};

export async function upsertFnbOrgSnapshot(
  organizationId: string,
  snap: {
    edition?: string;
    activeModules?: string[];
  },
): Promise<FnbOrgProfileRow> {
  const edition = (snap.edition ?? "hotel").trim() || "hotel";
  const kafe = edition.toLowerCase() === "kafe";
  const activeModules = snap.activeModules ?? [];
  const row = await prisma.fnbOrgProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      edition,
      hotelMode: !kafe,
      waiterPinPacks: kafe && activeModules.includes("fnb_waiter_pin") ? 1 : kafe ? 0 : 1,
      activeModules,
    },
    update: {
      edition,
      hotelMode: !kafe,
      activeModules,
    },
  });
  return {
    organizationId: row.organizationId,
    edition: row.edition,
    hotelMode: row.hotelMode,
    waiterPinPacks: row.waiterPinPacks,
    activeModules: row.activeModules,
  };
}

export async function getFnbOrgProfile(
  organizationId = requestOrganizationId(),
): Promise<FnbOrgProfileRow> {
  const row = await prisma.fnbOrgProfile.findUnique({
    where: { organizationId },
  });
  if (!row) {
    return { organizationId, ...HOTEL_FALLBACK };
  }
  return {
    organizationId: row.organizationId,
    edition: row.edition,
    hotelMode: row.hotelMode,
    waiterPinPacks: row.waiterPinPacks,
    activeModules: row.activeModules,
  };
}

export async function isKafeHotelModeOff(
  organizationId?: string,
): Promise<boolean> {
  const p = await getFnbOrgProfile(organizationId);
  return p.edition.toLowerCase() === "kafe" || p.hotelMode === false;
}

export function profileHasModule(
  profile: FnbOrgProfileRow,
  moduleKey: string,
): boolean {
  return profile.activeModules.includes(moduleKey);
}
