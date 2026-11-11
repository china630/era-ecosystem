import { Prisma } from "@prisma/client";
import {
  buildDelegatesFromPrismaClient,
  exportFullOrgSlice,
  fullOrgSliceSummary,
  importFullOrgSlice,
  runWithSatelliteTenant,
  type OrgFullSliceV2,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

const SATELLITE_KEY = "industry_hotel_pms";

function hotelDelegates() {
  return buildDelegatesFromPrismaClient(
    Prisma as never,
    prisma as unknown as Record<string, unknown>,
  );
}

/** Full org migrate for hotel satellite (all organizationId models + storage manifest stub). */
export async function exportHotelOrgSlice(
  organizationId: string,
): Promise<OrgFullSliceV2> {
  return runWithSatelliteTenant({ organizationId }, async () => {
    const { modelOrder, models } = hotelDelegates();
    return exportFullOrgSlice({
      organizationId,
      satelliteKey: SATELLITE_KEY,
      modelOrder,
      models,
      objectStorage: {
        prefix: `org/${organizationId}/`,
        // Listing hooked when hotel blob SoR is wired; stub keeps contract honest.
      },
    });
  });
}

export async function importHotelOrgSlice(input: {
  organizationId: string;
  slice: OrgFullSliceV2;
  mode: "validate" | "upsert";
}): Promise<
  | { ok: true; mode: "validate" | "upsert"; tables: OrgFullSliceV2["tables"] }
  | { ok: false; reason: string }
> {
  return runWithSatelliteTenant({ organizationId: input.organizationId }, async () => {
    const { models } = hotelDelegates();
    return importFullOrgSlice({
      organizationId: input.organizationId,
      models,
      slice: input.slice,
      mode: input.mode,
      copyObjectStorage: async (manifest) => {
        if (manifest.stub || !manifest.entries.length) return;
        // Target copy lands when blob SoR exposes copy-by-key; fail closed if entries present but no hook.
        throw new Error(
          "object-storage copy not configured for hotel (manifest has entries)",
        );
      },
    });
  });
}

export function hotelSliceMetaSummary(slice: OrgFullSliceV2) {
  return fullOrgSliceSummary(slice);
}
