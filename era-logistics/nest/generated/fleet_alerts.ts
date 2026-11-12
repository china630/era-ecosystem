import { listVehiclesWithExpiringCompliance } from "@/lib/fleet.service";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const DAYS_AHEAD = 30;

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/fleet/alerts", async (httpReq, httpRes) => {
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
    const until = new Date();
    until.setDate(until.getDate() + DAYS_AHEAD);

    const vehicles = await listVehiclesWithExpiringCompliance(until);

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

    return sendJson(httpRes, { daysAhead: DAYS_AHEAD, alerts });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
