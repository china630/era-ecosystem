import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const createdAt: { gte?: Date; lte?: Date } = {};
    if (fromParam) createdAt.gte = new Date(fromParam);
    if (toParam) createdAt.lte = new Date(toParam);

    const trips = await prisma.trip.findMany({
      where: {
        fuelCost: { not: null },
        ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      },
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
    });

    const byVehicle = new Map<
      string,
      { vehicleId: string; plate: string; liters: number; cost: number; tripCount: number }
    >();

    let totalLiters = 0;
    let totalCost = 0;

    for (const trip of trips) {
      const liters = trip.fuelLiters ? Number(trip.fuelLiters) : 0;
      const cost = trip.fuelCost ? Number(trip.fuelCost) : 0;
      totalLiters += liters;
      totalCost += cost;

      const key = trip.vehicleId;
      const row = byVehicle.get(key) ?? {
        vehicleId: trip.vehicleId,
        plate: trip.vehicle.plate,
        liters: 0,
        cost: 0,
        tripCount: 0,
      };
      row.liters += liters;
      row.cost += cost;
      row.tripCount += 1;
      byVehicle.set(key, row);
    }

    return jsonOk({
      from: fromParam,
      to: toParam,
      currency: "AZN",
      totals: {
        liters: Math.round(totalLiters * 100) / 100,
        cost: Math.round(totalCost * 100) / 100,
        tripCount: trips.length,
      },
      byVehicle: Array.from(byVehicle.values()),
      trips: trips.map((t) => ({
        id: t.id,
        routeCode: t.routeCode,
        status: t.status,
        plate: t.vehicle.plate,
        liters: t.fuelLiters ? Number(t.fuelLiters) : null,
        cost: t.fuelCost ? Number(t.fuelCost) : null,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
