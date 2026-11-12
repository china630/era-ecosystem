import { z } from "zod";
import { TripStatus } from "@prisma/client";
import { findTripWithVehicle, findTripStatusRow, updateTripStatus } from "@/lib/trip.service";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const statusSchema = z.object({
  status: z.enum(["IN_TRANSIT", "DELIVERED"]),
});

const NEXT_STATUS: Partial<Record<TripStatus, TripStatus>> = {
  PLANNED: TripStatus.IN_TRANSIT,
  IN_TRANSIT: TripStatus.DELIVERED,
};

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/trips/:id", async (httpReq, httpRes) => {
    if (!(await enterLogisticsStaff(httpReq, httpRes))) return;
    try {
      const session = await logisticsNestSession(httpReq);
      const web = await runWithLogisticsTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const trip = await findTripWithVehicle(id);
    if (!trip) return sendJson(httpRes, { error: "Trip not found" }, 404);
    return sendJson(httpRes, trip);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/trips/:id", async (httpReq, httpRes) => {
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
    const { id } = httpReq.params;
    const body = statusSchema.parse(httpReq.body);

    const trip = await findTripStatusRow(id);
    if (!trip) return sendJson(httpRes, { error: "Trip not found" }, 404);
    if (trip.status === "COMPLETED" || trip.status === "CANCELLED") {
      return sendJson(httpRes, { error: "Trip cannot change status" }, 409);
    }

    const expected = NEXT_STATUS[trip.status];
    if (!expected || expected !== body.status) {
      return sendJson(httpRes, { error: `Invalid transition from ${trip.status} to ${body.status}` }, 400);
    }

    const updated = await updateTripStatus(id, {
      status: body.status,
      ...(body.status === "IN_TRANSIT" && !trip.startedAt
        ? { startedAt: new Date() }
        : {}),
    });

    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
