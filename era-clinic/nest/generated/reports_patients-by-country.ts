import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patientsByCountryReport } from "@/domain/reports/patients-by-country.service";
import { billingPeriodKeyBaku } from "@era/satellite-kit/time";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  origin: z.enum(["IN_HOUSE", "WALK_IN"]).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/patients-by-country", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_DIAGNOSES);
    if (denied) return denied;
    if (!session?.organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const query = querySchema.parse({
      month: url.searchParams.get("month") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
    });
    const report = await patientsByCountryReport({
      organizationId: session.organizationId,
      periodKey: query.month ?? billingPeriodKeyBaku(),
      origin: query.origin ?? "IN_HOUSE",
    });
    const totals = report.items.reduce(
      (sum, row) => ({
        guests: sum.guests + row.guests,
        nights: sum.nights + row.nights,
        extras: sum.extras + row.extras,
      }),
      { guests: 0, nights: 0, extras: 0 },
    );
    return sendJson(httpRes, { ...report, totals });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
