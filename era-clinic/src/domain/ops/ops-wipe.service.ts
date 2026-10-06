import { isSentinelOrganizationId } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

/**
 * Operational rows (patients and visits included) and a separate catalog basket.
 * A parent stays when a child that points at it is kept.
 */

export const OPS_WIPE_KEYS = [
  "procedureOrders",
  "labOrders",
  "visits",
  "episodes",
  "patients",
] as const;

export const CATALOG_WIPE_KEYS = [
  "procedureTypes",
  "practitioners",
  "rooms",
  "programTemplates",
] as const;

export type OpsWipeKey = (typeof OPS_WIPE_KEYS)[number];
export type CatalogWipeKey = (typeof CATALOG_WIPE_KEYS)[number];

/** Unchecking `child` also clears every parent in this map. */
export const OPS_PARENTS: Record<OpsWipeKey, OpsWipeKey[]> = {
  procedureOrders: ["episodes", "patients"],
  labOrders: ["episodes", "patients"],
  visits: ["episodes", "patients"],
  episodes: ["patients"],
  patients: [],
};

const CATALOG_NEEDS_OPS: Record<CatalogWipeKey, OpsWipeKey[]> = {
  procedureTypes: ["procedureOrders"],
  practitioners: ["visits"],
  rooms: ["episodes"],
  programTemplates: ["episodes"],
};

function assertOrg(organizationId: string): string {
  const org = organizationId.trim();
  if (!org || isSentinelOrganizationId(org)) {
    throw Object.assign(new Error("Ops wipe requires a real organization id"), {
      status: 400,
    });
  }
  return org;
}

async function countMap(organizationId: string): Promise<Record<string, number>> {
  const org = { organizationId };
  const [
    procedureOrders,
    labOrders,
    visits,
    episodes,
    patients,
    procedureTypes,
    practitioners,
    rooms,
    programTemplates,
  ] = await Promise.all([
    prisma.procedureOrder.count({ where: org }),
    prisma.labOrder.count({ where: org }),
    prisma.visit.count({ where: org }),
    prisma.clinicalEpisode.count({ where: org }),
    prisma.patientRef.count({ where: org }),
    prisma.procedureType.count({ where: org }),
    prisma.practitioner.count({ where: org }),
    prisma.room.count({ where: org }),
    prisma.programTemplate.count({ where: org }),
  ]);
  return {
    procedureOrders,
    labOrders,
    visits,
    episodes,
    patients,
    procedureTypes,
    practitioners,
    rooms,
    programTemplates,
  };
}

export async function countClinicOpsWipe(organizationId: string) {
  return countMap(assertOrg(organizationId));
}

export function normalizeWipeSelection(input: {
  ops: string[];
  catalog: string[];
}): { ops: OpsWipeKey[]; catalog: CatalogWipeKey[] } {
  const ops = new Set(input.ops.filter((k): k is OpsWipeKey => (OPS_WIPE_KEYS as readonly string[]).includes(k)));
  for (const key of OPS_WIPE_KEYS) {
    if (ops.has(key)) continue;
    for (const parent of OPS_PARENTS[key]) ops.delete(parent);
  }
  const catalog = new Set(
    input.catalog.filter((k): k is CatalogWipeKey =>
      (CATALOG_WIPE_KEYS as readonly string[]).includes(k),
    ),
  );
  for (const key of CATALOG_WIPE_KEYS) {
    if (!catalog.has(key)) continue;
    if (CATALOG_NEEDS_OPS[key].some((need) => !ops.has(need))) catalog.delete(key);
  }
  return { ops: [...ops], catalog: [...catalog] };
}

export async function runClinicOpsWipe(
  organizationId: string,
  selection?: { ops?: string[]; catalog?: string[] },
) {
  const org = assertOrg(organizationId);
  const chosen = normalizeWipeSelection({
    ops: selection?.ops ?? [...OPS_WIPE_KEYS],
    catalog: selection?.catalog ?? [],
  });
  const before = await countMap(org);
  const byOrg = { organizationId: org };

  await prisma.$transaction(
    async (tx) => {
      if (chosen.ops.includes("procedureOrders")) {
        await tx.resourceBooking.deleteMany({
          where: { organizationId: org, procedureOrderId: { not: null } },
        });
        await tx.procedureChargeLog.deleteMany({ where: byOrg });
        await tx.procedureOrder.deleteMany({ where: byOrg });
      }
      if (chosen.ops.includes("labOrders")) {
        await tx.labOrder.deleteMany({ where: byOrg });
      }
      if (chosen.ops.includes("visits")) {
        await tx.clinicReceipt.deleteMany({ where: byOrg });
        await tx.visit.deleteMany({ where: byOrg });
        await tx.appointment.deleteMany({ where: byOrg });
      }
      if (chosen.ops.includes("episodes")) {
        await tx.clinicalEpisode.deleteMany({ where: byOrg });
      }
      if (chosen.ops.includes("patients")) {
        await tx.patientRef.deleteMany({ where: byOrg });
      }
      if (chosen.catalog.includes("programTemplates")) {
        await tx.programTemplate.deleteMany({ where: byOrg });
      }
      if (chosen.catalog.includes("procedureTypes")) {
        await tx.procedureType.deleteMany({ where: byOrg });
      }
      if (chosen.catalog.includes("practitioners")) {
        await tx.practitioner.deleteMany({ where: byOrg });
      }
      if (chosen.catalog.includes("rooms")) {
        await tx.room.deleteMany({ where: byOrg });
      }
    },
    { timeout: 120_000 },
  );

  return { before, deletedKeys: chosen };
}
