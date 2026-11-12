import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { processAppointmentRemindersForOrganization } from "@/domain/appointment/appointment-calendar.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** SHARED: orch pool registry (kit). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/cron/appointment-reminders", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "platform_notifications",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => {
        const { scanned, sent } = await processAppointmentRemindersForOrganization(
          organizationId,
        );
        return { organizationId, scanned, sent };
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) {
        return sendJson(httpRes, { error: gate.reason }, 503);
      }
      return sendJson(httpRes, { skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }
    return sendJson(httpRes, { byOrganization: gate.results });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
