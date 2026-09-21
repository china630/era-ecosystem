import { reportPosStationCapacity } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

/** Distinct retail registers that have had a shift. */
export async function reportRetailPosStationCapacity(prisma: {
  shift: {
    findMany: (args: {
      where: { organizationId: string };
      select: { registerId: true };
      distinct: ["registerId"];
    }) => Promise<{ registerId: string }[]>;
  };
}): Promise<void> {
  const organizationId = requestOrganizationId();
  if (!organizationId) return;
  const registers = await prisma.shift.findMany({
    where: { organizationId },
    select: { registerId: true },
    distinct: ["registerId"],
  });
  await reportPosStationCapacity({
    organizationId,
    satelliteKey: "industry_retail",
    billableStationCount: registers.length,
  });
}
