import { z } from "zod";
import { jsonError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { exportBuffetCostRunSlice } from "@/lib/buffet-cost-run-export.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Buffet cost-run export for Finance (Waves 3–4).
 * POS sale + named COMP bucket from closed tickets; staff overlap netting.
 * Unit COGS map is optional until Finance prices BOM (warnings when missing).
 */
const bodySchema = z.object({
  outletId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  foodUsageAzn: z.number().min(0).default(0),
  staffGrossAzn: z.number().min(0).default(0),
  unitCogsBySku: z.record(z.string(), z.number().min(0)).optional(),
  defaultUnitCogsAzn: z.number().min(0).optional(),
});

const querySchema = z.object({
  outletId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  foodUsageAzn: z.coerce.number().min(0).default(0),
  staffGrossAzn: z.coerce.number().min(0).default(0),
  defaultUnitCogsAzn: z.coerce.number().min(0).optional(),
});

function mapExportError(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "OUTLET_NOT_FOUND") return jsonError("Outlet not found", 404);
    if (code === "INVALID_DATE_RANGE") {
      return jsonError("from must be on or before to (YYYY-MM-DD)", 400);
    }
  }
  return null;
}

function assertDateOrder(from: string, to: string) {
  if (from > to) {
    throw Object.assign(new Error("INVALID_DATE_RANGE"), { code: "INVALID_DATE_RANGE" });
  }
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/buffet/cost-run-export", async (httpReq, httpRes) => {
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
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      outletId: url.searchParams.get("outletId"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      foodUsageAzn: url.searchParams.get("foodUsageAzn") ?? "0",
      staffGrossAzn: url.searchParams.get("staffGrossAzn") ?? "0",
      defaultUnitCogsAzn: url.searchParams.get("defaultUnitCogsAzn") ?? undefined,
    });
    assertDateOrder(parsed.from, parsed.to);
    const slice = await exportBuffetCostRunSlice({
      outletId: parsed.outletId,
      fromYmd: parsed.from,
      toYmd: parsed.to,
      foodUsageAzn: parsed.foodUsageAzn,
      staffGrossAzn: parsed.staffGrossAzn,
      defaultUnitCogsAzn: parsed.defaultUnitCogsAzn,
    });
    return sendJson(httpRes, slice);
  } catch (err) {
    return mapExportError(err) ?? handleRouteError(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/buffet/cost-run-export", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse(httpReq.body);
    assertDateOrder(body.from, body.to);
    const slice = await exportBuffetCostRunSlice({
      outletId: body.outletId,
      fromYmd: body.from,
      toYmd: body.to,
      foodUsageAzn: body.foodUsageAzn,
      staffGrossAzn: body.staffGrossAzn,
      unitCogsBySku: body.unitCogsBySku,
      defaultUnitCogsAzn: body.defaultUnitCogsAzn,
    });
    return sendJson(httpRes, slice);
  } catch (err) {
    return mapExportError(err) ?? handleRouteError(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
