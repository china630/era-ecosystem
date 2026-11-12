import { z } from "zod";
import { ServiceCatalogKind } from "@prisma/client";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { resolveDepartmentWrite } from "@/domain/catalog/service-department.service";
import { parseCatalogKindQuery } from "@/domain/catalog/service-catalog-kind";
import { listServiceCatalogAdminRows, findServiceCatalogByCode, createServiceCatalogRow } from "@/lib/services/clinic-master-data.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const writeSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  descriptionAz: z.string().optional().nullable(),
  descriptionRu: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
  department: z.string().optional().nullable(),
  departmentCode: z.string().optional().nullable(),
  kind: z.nativeEnum(ServiceCatalogKind).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/catalog", async (httpReq, httpRes) => {
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
    const kinds = parseCatalogKindQuery(url.searchParams.get("kind"));
    const missingListPrice = url.searchParams.get("missingListPrice") === "1";
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : undefined;

    const rows = await listServiceCatalogAdminRows({
      kinds: kinds ?? undefined,
      q: q || undefined,
      limit,
      missingListPrice,
    });
    return sendJson(httpRes, rows);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/catalog", async (httpReq, httpRes) => {
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
    const body = writeSchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const code = body.code.trim();
    const existing = await findServiceCatalogByCode(code);
    if (existing) return sendJson(httpRes, { error: "Code already exists" }, 409);
    const listAmount = body.amount > 0 ? body.amount : null;
    const effectiveFrom = body.effectiveFrom
      ? bakuDayBounds(body.effectiveFrom).start
      : new Date();
    const dept = await resolveDepartmentWrite(organizationId, body);
    const row = await createServiceCatalogRow({
      organizationId,
      code,
      description: body.description.trim(),
      descriptionAz: body.descriptionAz?.trim() || null,
      descriptionRu: body.descriptionRu?.trim() || null,
      descriptionEn: body.descriptionEn?.trim() || null,
      amount: body.amount,
      listAmount,
      department: dept.department,
      departmentCode: dept.departmentCode,
      kind: body.kind ?? "OTHER",
      syncedAt: new Date(),
    });
    await recordCatalogPriceIfChanged({
      organizationId,
      code,
      amount: body.amount,
      listAmount,
      effectiveFrom,
    });
    return sendJson(httpRes, row, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
