import { reportPosStationCapacity } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

/**
 * Distinct F&B outlets that have ever had a POS shift — not KKM hardware rows.
 */
export async function reportFnbPosStationCapacity(prisma: {
  posShift: {
    findMany: (args: {
      where: { organizationId: string };
      select: { outletId: true };
      distinct: ["outletId"];
    }) => Promise<{ outletId: string }[]>;
  };
}): Promise<void> {
  const organizationId = requestOrganizationId();
  if (!organizationId) return;
  const outlets = await prisma.posShift.findMany({
    where: { organizationId },
    select: { outletId: true },
    distinct: ["outletId"],
  });
  await reportPosStationCapacity({
    organizationId,
    satelliteKey: "industry_fnb_pos",
    billableStationCount: outlets.length,
  });
}
