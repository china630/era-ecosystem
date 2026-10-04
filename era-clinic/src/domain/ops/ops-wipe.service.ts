import { isSentinelOrganizationId } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

/**
 * Operational wipe for one clinic org: procedure orders and the rows that only
 * exist to place them (allocations and sites cascade, resource bookings that
 * point at an order, charge log). Catalogs (practitioners, rooms, procedure
 * types, patients, visits) stay. Package quota counters are not rebuilt.
 */

export type ClinicOpsWipeCounts = {
  procedureOrders: number;
  procedureAllocations: number;
  procedureOrderSites: number;
  procedureResourceBookings: number;
  procedureChargeLogs: number;
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

export async function countClinicOpsWipe(
  organizationId: string,
): Promise<ClinicOpsWipeCounts> {
  const org = assertOrg(organizationId);
  const byOrg = { organizationId: org };
  const orderBooking = { organizationId: org, procedureOrderId: { not: null } };
  const [
    procedureOrders,
    procedureAllocations,
    procedureOrderSites,
    procedureResourceBookings,
    procedureChargeLogs,
  ] = await Promise.all([
    prisma.procedureOrder.count({ where: byOrg }),
    prisma.procedureAllocation.count({ where: byOrg }),
    prisma.procedureOrderSite.count({ where: byOrg }),
    prisma.resourceBooking.count({ where: orderBooking }),
    prisma.procedureChargeLog.count({ where: byOrg }),
  ]);
  return {
    procedureOrders,
    procedureAllocations,
    procedureOrderSites,
    procedureResourceBookings,
    procedureChargeLogs,
  };
}

export async function runClinicOpsWipe(
  organizationId: string,
): Promise<ClinicOpsWipeCounts> {
  const org = assertOrg(organizationId);
  const before = await countClinicOpsWipe(org);
  const byOrg = { organizationId: org };

  await prisma.$transaction(
    async (tx) => {
      await tx.resourceBooking.deleteMany({
        where: { organizationId: org, procedureOrderId: { not: null } },
      });
      await tx.procedureChargeLog.deleteMany({ where: byOrg });
      await tx.procedureOrder.deleteMany({ where: byOrg });
    },
    { timeout: 60_000 },
  );

  return before;
}
