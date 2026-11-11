import { z } from "zod";
import { financeRateQuote } from "@era/satellite-kit";
import { findTripById, createTariffQuoteLog } from "@/lib/trip.service";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  weightKg: z.number().min(0),
  zoneFrom: z.string().optional(),
  zoneTo: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/shipments/:id/rate", async (httpReq, httpRes) => {
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
    const trip = await findTripById(id);
    if (!trip) return sendJson(httpRes, { error: "Trip not found" }, 404);
    const body = bodySchema.parse(httpReq.body);
    const quote = await financeRateQuote(body, {
      authHeader: req.headers.get("authorization"),
    });
    await createTariffQuoteLog({
      tripId: id,
      weightKg: body.weightKg,
      amount: quote.amount ?? 0,
      currency: quote.currency ?? "AZN",
    });
    return sendJson(httpRes, { tripId: id, ...quote });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
