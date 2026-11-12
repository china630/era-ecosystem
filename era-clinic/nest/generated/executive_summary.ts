import { hasBusinessOwnerRole } from "@/lib/api-utils";
import { getCapacitySummary } from "@/lib/capacity.service";
import { executiveDayBlocks } from "@/domain/ops/executive-day.service";
import { countExecutiveRangeMetrics } from "@/domain/ops/day-summary.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function resolveRangeBounds(input: { date?: string; from?: string; to?: string }) {
  const fromYmd = (input.from ?? input.date)?.trim() || todayBakuYmd();
  const toYmd = (input.to ?? input.date)?.trim() || fromYmd;
  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;
  const { start } = bakuDayBounds(lo);
  const { end } = bakuDayBounds(hi);
  return { ymd: hi, start, end };
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/executive/summary", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    if (!hasBusinessOwnerRole(session)) {
      return sendJson(httpRes, { error: "BUSINESS_OWNER required" }, 403);
    }

    const url = new URL(req.url);
    const { ymd, start, end } = resolveRangeBounds({
      date: url.searchParams.get("date") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const [{ visitsToday, openLabOrders }, blocks, capacity] = await Promise.all([
      countExecutiveRangeMetrics({ start, end }),
      executiveDayBlocks({
        from: start,
        to: end,
      }),
      getCapacitySummary(start),
    ]);

    return sendJson(httpRes, {
      date: ymd,
      visitsToday,
      blocks,
      openLabOrders,
      currency: "AZN",
      capacity,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
