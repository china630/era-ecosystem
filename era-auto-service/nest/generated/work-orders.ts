import { z } from "zod";
import { createWorkOrder, listWorkOrders } from "@/lib/work-order.service";
import { upsertCustomerVehicleByPlate } from "@/lib/vehicle.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string(),
  vehicleId: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vin: z.string().optional(),
  laborAmount: z.number().nonnegative().default(0),
  partsAmount: z.number().nonnegative().default(0),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/work-orders", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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
    const orders = await listWorkOrders();
    return sendJson(httpRes, orders);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/work-orders", async (httpReq, httpRes) => {
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
    const body = createSchema.parse(httpReq.body);
    let vehicleId = body.vehicleId;
    if (!vehicleId && body.vehiclePlate) {
      const v = await upsertCustomerVehicleByPlate(
        body.vehiclePlate.toUpperCase(),
        body.vin?.trim(),
      );
      vehicleId = v.id;
    }
    const order = await createWorkOrder({
      code: body.code,
      vehicleId,
      vehiclePlate: body.vehiclePlate?.toUpperCase(),
      vin: body.vin?.trim(),
      laborAmount: body.laborAmount,
      partsAmount: body.partsAmount,
    });
    return sendJson(httpRes, order, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
