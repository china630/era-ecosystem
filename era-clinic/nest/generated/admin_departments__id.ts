import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { departmentFallbackLabel, getServiceDepartmentById, updateServiceDepartmentRow, syncCatalogDepartmentLabels, countServiceCatalogForDepartment, deleteServiceDepartmentRow } from "@/domain/catalog/service-department.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  nameAz: z.string().optional().nullable(),
  nameRu: z.string().optional().nullable(),
  nameEn: z.string().optional().nullable(),
  active: z.boolean().optional(),
  hotelRevenueCode: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/departments/:id", async (httpReq, httpRes) => {
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
    const existing = await getServiceDepartmentById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    const body = patchSchema.parse(httpReq.body);
    const row = await updateServiceDepartmentRow(id, {
      ...(body.code != null ? { code: body.code.trim().toUpperCase() } : {}),
      ...(body.nameAz !== undefined ? { nameAz: body.nameAz?.trim() || null } : {}),
      ...(body.nameRu !== undefined ? { nameRu: body.nameRu?.trim() || null } : {}),
      ...(body.nameEn !== undefined ? { nameEn: body.nameEn?.trim() || null } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.hotelRevenueCode !== undefined
        ? { hotelRevenueCode: body.hotelRevenueCode?.trim() || null }
        : {}),
    });
    const label = departmentFallbackLabel(row);
    await syncCatalogDepartmentLabels(row.code, label);
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/departments/:id", async (httpReq, httpRes) => {
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
    const existing = await getServiceDepartmentById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    const serviceCount = await countServiceCatalogForDepartment(
      existing.organizationId,
      existing.code,
    );
    if (serviceCount > 0) {
      return sendJson(httpRes, { error: "Department still has services", ...{
        code: "DEPARTMENT_IN_USE",
        serviceCount,
      } }, 409);
    }
    await deleteServiceDepartmentRow(id);
    return sendJson(httpRes, { id });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
