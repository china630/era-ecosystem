import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const DAYS_AHEAD = 30;

export async function GET() {
  try {
    const until = new Date();
    until.setDate(until.getDate() + DAYS_AHEAD);

    const vehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { insuranceExpiresAt: { lte: until } },
          { inspectionExpiresAt: { lte: until } },
          { permitExpiresAt: { lte: until } },
        ],
      },
      orderBy: { plate: "asc" },
    });

    const alerts = vehicles.flatMap((v) => {
      const items: Array<{
        vehicleId: string;
        plate: string;
        type: string;
        expiresAt: Date;
      }> = [];
      if (v.insuranceExpiresAt && v.insuranceExpiresAt <= until) {
        items.push({
          vehicleId: v.id,
          plate: v.plate,
          type: "insurance",
          expiresAt: v.insuranceExpiresAt,
        });
      }
      if (v.inspectionExpiresAt && v.inspectionExpiresAt <= until) {
        items.push({
          vehicleId: v.id,
          plate: v.plate,
          type: "inspection",
          expiresAt: v.inspectionExpiresAt,
        });
      }
      if (v.permitExpiresAt && v.permitExpiresAt <= until) {
        items.push({
          vehicleId: v.id,
          plate: v.plate,
          type: "permit",
          expiresAt: v.permitExpiresAt,
        });
      }
      return items;
    });

    return jsonOk({ daysAhead: DAYS_AHEAD, alerts });
  } catch (err) {
    return handleRouteError(err);
  }
}
