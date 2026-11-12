import { listTripsWithFuelCost } from "@/lib/trip.service";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/fuel", async (httpReq, httpRes) => {
    if (!(await enterLogisticsStaff(httpReq, httpRes))) return;
    try {
      const session = await logisticsNestSession(httpReq);
      const web = await runWithLogisticsTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const createdAt: { gte?: Date; lte?: Date } = {};
    if (fromParam) createdAt.gte = new Date(fromParam);
    if (toParam) createdAt.lte = new Date(toParam);

    const trips = await listTripsWithFuelCost(
      Object.keys(createdAt).length > 0 ? createdAt : undefined,
    );

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

    return sendJson(httpRes, {
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
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
