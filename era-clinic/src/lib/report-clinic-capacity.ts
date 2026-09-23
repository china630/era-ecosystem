import { reportClinicCapacity } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

/** Count Room and Bed rows (not wards or equipment) and report to orch meters. */
export async function reportClinicRoomBedCapacity(organizationId: string): Promise<{
  roomCount: number;
  bedCount: number;
}> {
  const [roomCount, bedCount] = await Promise.all([
    prisma.room.count({ where: { organizationId } }),
    prisma.bed.count({ where: { organizationId } }),
  ]);
  await reportClinicCapacity({ organizationId, roomCount, bedCount });
  return { roomCount, bedCount };
}
