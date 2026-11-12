import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { programTemplateCreateSchema, shapeProgramTemplate, listProgramTemplatesForAdmin, createProgramTemplateFromAdmin, findCurrentProgramTemplateByCode, deleteProgramTemplateAdmin, parseDateOnly, bakuDateOnly, purgeRetiredTemplatesWithoutInstances, backfillEntitlementSnapshots } from "@/domain/sanatorium/program-template-admin";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/program-templates", async (httpReq, httpRes) => {
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
    const url = new URL(req.url);
    const includeRetired = url.searchParams.get("includeRetired") === "1";
    return sendJson(httpRes, await listProgramTemplatesForAdmin(includeRetired));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/program-templates", async (httpReq, httpRes) => {
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
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "purge-retired") {
      const body = ((httpReq.body ?? {})) as {
        olderThanDays?: number;
      };
      const result = await purgeRetiredTemplatesWithoutInstances({
        olderThanDays:
          typeof body.olderThanDays === "number" ? body.olderThanDays : 0,
      });
      return sendJson(httpRes, result);
    }
    if (action === "backfill-snapshots") {
      const result = await backfillEntitlementSnapshots();
      return sendJson(httpRes, result);
    }

    const body = programTemplateCreateSchema.parse(httpReq.body);
    const existingCurrent = await findCurrentProgramTemplateByCode(body.code);
    if (existingCurrent) {
      return sendJson(httpRes, 
        { error: "CODE_EXISTS", message: "A current package with this code already exists" },
        409,
      );
    }
    const effectiveFrom =
      parseDateOnly(body.effectiveFrom ?? null) ?? parseDateOnly(bakuDateOnly());
    const effectiveTo = parseDateOnly(body.effectiveTo ?? null);
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      return sendJson(httpRes, 
        { error: "INVALID_VALIDITY_RANGE", message: "Valid-to must not precede valid-from" },
        400,
      );
    }
    const row = await createProgramTemplateFromAdmin(body);
    return sendJson(httpRes, shapeProgramTemplate({ ...row, openInstanceCount: 0, pinInstanceCount: 0 }), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/program-templates", async (httpReq, httpRes) => {
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
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return sendJson(httpRes, { error: "id required" }, 400);
    const result = await deleteProgramTemplateAdmin(id);
    if (result.closed) {
      return sendJson(httpRes, {
        deleted: false,
        closed: true,
        effectiveTo: result.effectiveTo,
        pinnedInstances: result.pinnedInstances,
      });
    }
    return sendJson(httpRes, { deleted: true, closed: false });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
