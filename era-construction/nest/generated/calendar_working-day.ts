import { z } from "zod";
import { isConstructionWorkingDay, constructionSlaDueDate } from "@/lib/production-calendar";
import { enterConstructionStaff, constructionNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithConstructionTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const dateQuery = z.object({ date: z.string() });
const slaQuery = z.object({
  from: z.string(),
  days: z.coerce.number().int().min(0).max(90),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/calendar/working-day", async (httpReq, httpRes) => {
    if (!(await enterConstructionStaff(httpReq, httpRes))) return;
    try {
      const session = await constructionNestSession(httpReq);
      const web = await runWithConstructionTenant(session, async () => {
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
    const mode = url.searchParams.get("mode");
    if (mode === "sla") {
      const params = slaQuery.parse({
        from: url.searchParams.get("from"),
        days: url.searchParams.get("days") ?? "1",
      });
      const due = await constructionSlaDueDate(params.from, params.days);
      return sendJson(httpRes, { from: params.from, businessDays: params.days, due, source: "era-data-hub" });
    }
    const params = dateQuery.parse({ date: url.searchParams.get("date") });
    const isWorking = await isConstructionWorkingDay(params.date);
    return sendJson(httpRes, { date: params.date, isWorking, source: "era-data-hub" });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
