import { z } from "zod";
import { wholesaleTermDueDate } from "@/lib/production-calendar";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  from: z.string(),
  days: z.coerce.number().int().min(0).max(365),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/payment-terms/due-date", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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
    const params = querySchema.parse({
      from: url.searchParams.get("from"),
      days: url.searchParams.get("days") ?? "30",
    });
    const dueDate = await wholesaleTermDueDate(params.from, params.days);
    return sendJson(httpRes, {
      from: params.from,
      paymentTermDays: params.days,
      dueDate,
      source: "era-data-hub",
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
