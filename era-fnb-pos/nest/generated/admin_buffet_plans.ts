import { NextResponse } from "next/server";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_MEALS, BUFFET_STATUSES, listBuffetPlans, upsertBuffetPlan } from "@/lib/buffet-planner";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  outletId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(BUFFET_MEALS),
  coversAdult: z.number().int().min(0).max(5000),
  coversChild: z.number().int().min(0).max(5000).default(0),
  coversSource: z.enum(["MANUAL", "HOTEL", "MIXED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/buffet/plans", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const statusRaw = url.searchParams.get("status");
    const status =
      statusRaw && (BUFFET_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof BUFFET_STATUSES)[number])
        : undefined;
    const plans = await listBuffetPlans({
      outletId: url.searchParams.get("outletId") ?? undefined,
      fromYmd: url.searchParams.get("from") ?? undefined,
      toYmd: url.searchParams.get("to") ?? undefined,
      status,
    });
    return sendJson(httpRes, { plans });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/buffet/plans", async (httpReq, httpRes) => {
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

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = createSchema.parse(httpReq.body);
    const plan = await upsertBuffetPlan({
      outletId: body.outletId,
      serviceDateYmd: body.serviceDate,
      meal: body.meal,
      coversAdult: body.coversAdult,
      coversChild: body.coversChild,
      coversSource: body.coversSource,
      notes: body.notes,
    });
    return sendJson(httpRes, plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "OUTLET_NOT_FOUND") {
      return sendJson(httpRes, { error: "Outlet not found" }, 404);
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
