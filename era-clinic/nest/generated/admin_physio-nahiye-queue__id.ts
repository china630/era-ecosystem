import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { aliasNahiyeQueueItem, ignoreNahiyeQueueItem } from "@/domain/physio/nahiye-cutover.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  action: z.enum(["ignore", "alias"]),
  siteId: z.string().min(1).optional(),
  alias: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/physio-nahiye-queue/:id", async (httpReq, httpRes) => {
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

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    if (body.action === "ignore") {
      const row = await ignoreNahiyeQueueItem(id);
      await recordClinicAudit(
        { userId: guard.session.sub, request: req },
        "PhysioNahiyeQueue",
        id,
        "UPDATE",
        { action: "ignore" },
      );
      return sendJson(httpRes, row);
    }
    if (!body.siteId) {
      return sendJson(httpRes, { error: "siteId required to add an alias" }, 400);
    }
    const row = await aliasNahiyeQueueItem(id, body.siteId, body.alias);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "PhysioNahiyeQueue",
      id,
      "UPDATE",
      { action: "alias", siteId: body.siteId },
    );
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
