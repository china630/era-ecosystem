import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { PackageAssignError, replacePackageProcedures } from "@/domain/sanatorium/package-assign.service";
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  fromCode: z.string().min(1),
  toCode: z.string().min(1),
  qty: z.number().int().positive().max(40),
  assignBatchId: z.string().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/sanatorium/episodes/:id/package-assign/replace", async (httpReq, httpRes) => {
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

  try {
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = schema.parse(httpReq.body);

    const isManager = sessionHasClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_FO_MANAGER,
    );

    const result = await replacePackageProcedures(
      id,
      body,
      {
        confirmedByUserId: session.sub,
        allowOutOfPackage: isManager,
      },
    );
    return sendJson(httpRes, result);
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code, misses: err.misses } }, err.status);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
