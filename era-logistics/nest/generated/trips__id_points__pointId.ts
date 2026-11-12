import { z } from "zod";
import { findTripPoint, updateTripPoint } from "@/lib/trip.service";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  status: z.enum(["PENDING", "ARRIVED", "DELIVERED"]),
  podRecipient: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/trips/:id/points/:pointId", async (httpReq, httpRes) => {
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
    const { id, pointId } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const point = await findTripPoint(id, pointId);
    if (!point) return sendJson(httpRes, { error: "Point not found" }, 404);
    const updated = await updateTripPoint(pointId, {
      status: body.status,
      podRecipient: body.podRecipient,
      podCapturedAt: body.status === "DELIVERED" ? new Date() : point.podCapturedAt,
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
