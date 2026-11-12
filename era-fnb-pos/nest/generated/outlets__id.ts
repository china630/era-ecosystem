import { z } from "zod";
import { countOpenPosShiftsForOutlet, deleteOutletById, findOutletById, outletXReportHiddenValue, updateOutlet } from "@/lib/outlet.service";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const optionalContact = z.string().max(200).nullable().optional();

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(1).max(32).optional(),
  revenueCenterCode: z.string().min(1).max(32).nullable().optional(),
  financeWarehouseCode: z.string().max(64).nullable().optional(),
  active: z.boolean().optional(),
  capTill: z.boolean().optional(),
  capTables: z.boolean().optional(),
  capBuffetPlanner: z.boolean().optional(),
  shapeHint: z.enum(["cafe", "restaurant", "buffet_kitchen", "disco"]).nullable().optional(),
  hallMode: z.boolean().optional(),
  xReportHidden: z.array(z.string().min(1).max(32)).nullable().optional(),
  phone: optionalContact,
  email: optionalContact,
  address: optionalContact,
  website: optionalContact,
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/outlets/:id", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.OUTLETS_MANAGE,
      PERMISSIONS.HOTEL_REVENUE_CODES,
    ]);
    if (denied) return denied;
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const canManage = sessionHasFnbPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    const canRevenue = sessionHasFnbPermission(session, PERMISSIONS.HOTEL_REVENUE_CODES);
    if (
      (body.name !== undefined ||
        body.code !== undefined ||
        body.capTill !== undefined ||
        body.capTables !== undefined ||
        body.capBuffetPlanner !== undefined ||
        body.shapeHint !== undefined ||
        body.hallMode !== undefined ||
        body.xReportHidden !== undefined) &&
      !canManage
    ) {
      return sendJson(httpRes, { error: "Outlet profile requires outlets.manage" }, 403);
    }
    if (body.active !== undefined && !canManage) {
      return sendJson(httpRes, { error: "Outlet active flag requires outlets.manage" }, 403);
    }
    if (
      (body.phone !== undefined ||
        body.email !== undefined ||
        body.address !== undefined ||
        body.website !== undefined) &&
      !canManage
    ) {
      return sendJson(httpRes, { error: "Outlet contacts require outlets.manage" }, 403);
    }
    if (
      (body.revenueCenterCode !== undefined || body.financeWarehouseCode !== undefined) &&
      !canRevenue &&
      !canManage
    ) {
      return sendJson(httpRes, { error: "Revenue mapping requires hotel.revenue_codes or outlets.manage" }, 403);
    }
    const existing = await findOutletById(id);
    if (!existing) return sendJson(httpRes, { error: "Outlet not found" }, 404);
    if (
      body.revenueCenterCode === undefined &&
      body.financeWarehouseCode === undefined &&
      body.name === undefined &&
      body.code === undefined &&
      body.active === undefined &&
      body.capTill === undefined &&
      body.capTables === undefined &&
      body.capBuffetPlanner === undefined &&
      body.shapeHint === undefined &&
      body.hallMode === undefined &&
      body.xReportHidden === undefined &&
      body.phone === undefined &&
      body.email === undefined &&
      body.address === undefined &&
      body.website === undefined
    ) {
      return sendJson(httpRes, { error: "No fields to update" }, 400);
    }
    if (body.code !== undefined) {
      const nextCode = body.code.trim().toUpperCase();
      if (nextCode === "RESTAURANT") {
        return sendJson(httpRes, { error: "Outlet code RESTAURANT is retired — use NAFTANI" }, 400);
      }
    }
    const trimOrNull = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null || !String(v).trim() ? null : String(v).trim();
    const updated = await updateOutlet(id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.code !== undefined ? { code: body.code.trim().toUpperCase() } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.capTill !== undefined ? { capTill: body.capTill } : {}),
      ...(body.capTables !== undefined ? { capTables: body.capTables } : {}),
      ...(body.capBuffetPlanner !== undefined
        ? { capBuffetPlanner: body.capBuffetPlanner }
        : {}),
      ...(body.shapeHint !== undefined ? { shapeHint: body.shapeHint } : {}),
      ...(body.hallMode !== undefined ? { hallMode: body.hallMode } : {}),
      ...(body.xReportHidden !== undefined
        ? { xReportHidden: outletXReportHiddenValue(body.xReportHidden) }
        : {}),
      ...(body.revenueCenterCode !== undefined
        ? {
            revenueCenterCode:
              body.revenueCenterCode === null || !body.revenueCenterCode.trim()
                ? "FOOD"
                : body.revenueCenterCode.trim(),
          }
        : {}),
      ...(body.financeWarehouseCode !== undefined
        ? { financeWarehouseCode: body.financeWarehouseCode?.trim() || null }
        : {}),
      ...(body.phone !== undefined ? { phone: trimOrNull(body.phone) } : {}),
      ...(body.email !== undefined ? { email: trimOrNull(body.email) } : {}),
      ...(body.address !== undefined ? { address: trimOrNull(body.address) } : {}),
      ...(body.website !== undefined ? { website: trimOrNull(body.website) } : {}),
    });
    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/outlets/:id", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = denyUnlessAnyPermission(session, [PERMISSIONS.OUTLETS_MANAGE]);
    if (denied) return denied;
    const { id } = httpReq.params;
    const existing = await findOutletById(id);
    if (!existing) return sendJson(httpRes, { error: "Outlet not found" }, 404);
    const openShifts = await countOpenPosShiftsForOutlet(id);
    if (openShifts > 0) {
      return sendJson(httpRes, { error: "Close open shifts before deleting this outlet" }, 409);
    }
    await deleteOutletById(id);
    return sendJson(httpRes, { ok: true, id });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
