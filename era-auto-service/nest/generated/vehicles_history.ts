import { findWorkOrdersByPlateOrVin } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/vehicles/history", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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
    const plate = url.searchParams.get("plate")?.trim();
    const vin = url.searchParams.get("vin")?.trim();
    if (!plate && !vin) return sendJson(httpRes, { error: "plate or vin required" }, 400);

    const orders = await findWorkOrdersByPlateOrVin(plate, vin);

    return sendJson(httpRes, {
      plate: plate ?? null,
      vin: vin ?? null,
      timeline: orders.map((o) => ({
        workOrderId: o.id,
        code: o.code,
        status: o.status,
        partsStatus: o.partsStatus,
        laborAmount: Number(o.laborAmount),
        partsAmount: Number(o.partsAmount),
        completedAt: o.completedAt,
        createdAt: o.createdAt,
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
