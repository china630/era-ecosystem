import { prisma } from "@/lib/prisma";

export function listVehiclesWithExpiringCompliance(until: Date) {
  return prisma.vehicle.findMany({
    where: {
      OR: [
        { insuranceExpiresAt: { lte: until } },
        { inspectionExpiresAt: { lte: until } },
        { permitExpiresAt: { lte: until } },
      ],
    },
    orderBy: { plate: "asc" },
  });
}
