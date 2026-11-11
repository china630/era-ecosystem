import { z } from "zod";
import { ServiceCatalogKind } from "@prisma/client";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { resolveDepartmentWrite } from "@/domain/catalog/service-department.service";
import { getServiceCatalogById, listServiceCatalogPricesByCatalogId, updateServiceCatalogRow, deleteServiceCatalogIfUnused } from "@/lib/services/clinic-master-data.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  description: z.string().min(1).optional(),
  descriptionAz: z.string().optional().nullable(),
  descriptionRu: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional(),
  department: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  kind: z.nativeEnum(ServiceCatalogKind).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/catalog/:id", async (httpReq, httpRes) => {
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
    const row = await getServiceCatalogById(id);
    if (!row) return sendJson(httpRes, { error: "Not found" }, 404);
    const prices = await listServiceCatalogPricesByCatalogId(id);
    return sendJson(httpRes, { ...row, prices });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/catalog/:id", async (httpReq, httpRes) => {
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
    const existing = await getServiceCatalogById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    const body = patchSchema.parse(httpReq.body);
    const amount = body.amount ?? Number(existing.amount);
    const listAmount =
      body.amount != null
        ? amount > 0
          ? amount
          : null
        : existing.listAmount == null
          ? null
          : Number(existing.listAmount);
    const effectiveFrom = body.effectiveFrom
      ? bakuDayBounds(body.effectiveFrom).start
      : new Date();
    const dept =
      body.departmentCode !== undefined || body.department !== undefined
        ? await resolveDepartmentWrite(existing.organizationId || requestOrganizationId(), {
            departmentCode: body.departmentCode,
            department: body.department,
          })
        : null;
    const row = await updateServiceCatalogRow(id, {
      ...(body.description != null ? { description: body.description.trim() } : {}),
      ...(body.descriptionAz !== undefined ? { descriptionAz: body.descriptionAz?.trim() || null } : {}),
      ...(body.descriptionRu !== undefined ? { descriptionRu: body.descriptionRu?.trim() || null } : {}),
      ...(body.descriptionEn !== undefined ? { descriptionEn: body.descriptionEn?.trim() || null } : {}),
      ...(body.amount != null
        ? { amount: body.amount, listAmount, packageIncluded: false }
        : {}),
      ...(dept
        ? { department: dept.department, departmentCode: dept.departmentCode }
        : {}),
      ...(body.kind != null ? { kind: body.kind } : {}),
      syncedAt: new Date(),
    });
    await recordCatalogPriceIfChanged({
      organizationId: existing.organizationId || requestOrganizationId(),
      code: existing.code,
      amount,
      listAmount,
      effectiveFrom,
    });
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/catalog/:id", async (httpReq, httpRes) => {
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
    const result = await deleteServiceCatalogIfUnused(id);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") return sendJson(httpRes, { error: "Not found" }, 404);
      return sendJson(httpRes, { error: "Catalog price is referenced by orders" }, 409);
    }
    return sendJson(httpRes, { id });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
