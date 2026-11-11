import { NextResponse } from "next/server";
import { runCronForEachTenant } from "@era/satellite-kit";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Service-token cron stub. SHARED: orch pool registry (kit). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/cron/catalog-sync", async (httpReq, httpRes) => {
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
      authorization: req.headers.get("authorization"),
      cronSecretEnv: "PLATFORM_CRON_SECRET",
      fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
    },
    async (organizationId) => {
      const base = process.env.ERA_CLINIC_URL ?? "http://127.0.0.1:3203";
      const res = await fetch(`${base.replace(/\/$/, "")}/api/catalog/sync`, {
        method: "POST",
        headers: { cookie: req.headers.get("cookie") ?? "" },
      });
      return {
        organizationId,
        status: res.status,
        data: httpReq.body,
      };
    },
  );
  if (!gate.ok) {
    if (gate.status === 401) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }
    if (gate.status === 503) {
      return sendJson(httpRes, { error: gate.reason }, 503);
    }
    return sendJson(httpRes, {
      skipped: true,
      reason: gate.reason,
      moduleKey: gate.moduleKey,
    });
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
