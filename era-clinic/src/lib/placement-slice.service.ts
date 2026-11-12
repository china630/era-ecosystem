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

const SATELLITE_KEY = "industry_clinic";

function clinicDelegates() {
  return buildDelegatesFromPrismaClient(
    Prisma as never,
    prisma as unknown as Record<string, unknown>,
  );
}

/** Full org migrate for clinic satellite. */
export async function exportClinicOrgSlice(
  organizationId: string,
): Promise<OrgFullSliceV2> {
  return runWithSatelliteTenant({ organizationId }, async () => {
    const { modelOrder, models } = clinicDelegates();
    return exportFullOrgSlice({
      organizationId,
      satelliteKey: SATELLITE_KEY,
      modelOrder,
      models,
      objectStorage: { prefix: `org/${organizationId}/` },
    });
  });
}

export async function importClinicOrgSlice(input: {
  organizationId: string;
  slice: OrgFullSliceV2;
  mode: "validate" | "upsert";
}): Promise<
  | { ok: true; mode: "validate" | "upsert"; tables: OrgFullSliceV2["tables"] }
  | { ok: false; reason: string }
> {
  return runWithSatelliteTenant({ organizationId: input.organizationId }, async () => {
    const { models } = clinicDelegates();
    return importFullOrgSlice({
      organizationId: input.organizationId,
      models,
      slice: input.slice,
      mode: input.mode,
      copyObjectStorage: async (manifest) => {
        if (manifest.stub || !manifest.entries.length) return;
        throw new Error(
          "object-storage copy not configured for clinic (manifest has entries)",
        );
      },
    });
  });
}

export function clinicSliceMetaSummary(slice: OrgFullSliceV2) {
  return fullOrgSliceSummary(slice);
}
