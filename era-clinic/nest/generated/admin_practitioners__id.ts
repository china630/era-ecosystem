import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updatePractitionerOpsCatalog, deletePractitioner, auditMasterChange, getPractitionerById } from "@/lib/services/clinic-master-data.service";
import { isCpWorkforceHireModeActive } from "@/lib/workforce-policy";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const opsUpdateSchema = z.object({
  specialty: z.string().nullable().optional(),
  defaultSlotMinutes: z.number().int().min(5).max(240).optional(),
  staffKind: z.enum(["DOCTOR", "NURSE", "LAB", "BATH", "MASSAGE"]).optional(),
});

function isProvisionedPractitioner(row: {
  globalPersonId?: string | null;
  financeEmployeeId?: string | null;
}): boolean {
  return Boolean(row.globalPersonId || row.financeEmployeeId);
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/practitioners/:id", async (httpReq, httpRes) => {
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
    const existing = await getPractitionerById(id);
    if (!existing) {
      return sendJson(httpRes, { error: "Not found" }, 404);
    }

    const cpWorkforce = await isCpWorkforceHireModeActive();
    const provisioned = isProvisionedPractitioner(existing);

    if (cpWorkforce || provisioned) {
      const body = opsUpdateSchema.parse(httpReq.body);
      const row = await updatePractitionerOpsCatalog(id, body);
      await auditMasterChange(
        { userId: guard.session.sub, request: req },
        "practitioner",
        id,
        "UPDATE_OPS",
        body,
      );
      return sendJson(httpRes, row);
    }

    return sendJson(httpRes, { error: 
      "Identity changes via CP Workforce only. Enable platform_workforce and hire from Workspace.", ...{ code: "WORKFORCE_OPS_CATALOG_ONLY" } }, 403);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/practitioners/:id", async (httpReq, httpRes) => {
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
    const existing = await getPractitionerById(id);
    if (!existing) {
      return sendJson(httpRes, { error: "Not found" }, 404);
    }

    if (isProvisionedPractitioner(existing) || (await isCpWorkforceHireModeActive())) {
      return sendJson(httpRes, { error: 
        "Deactivate provisioned staff in ERA Workspace → Workforce (terminate employment).", ...{ code: "WORKFORCE_DEACTIVATE_VIA_CP" } }, 403);
    }

    await deletePractitioner(id);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitioner",
      id,
      "DELETE",
    );
    return sendJson(httpRes, { deleted: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
