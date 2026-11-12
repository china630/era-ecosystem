import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";
import { listManagementMeals, signManagementMeal } from "@/lib/buffet-management-meals.service";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function canEditPastManagement(
  session: { role?: string | null; isOwner?: boolean } | null,
): boolean {
  if (!session) return false;
  if (session.isOwner === true) return true;
  const role = session.role ?? "";
  return (
    role === ROLE_CODES.MANAGER ||
    role === "FB_MANAGER" ||
    role === ROLE_CODES.KITCHEN ||
    role === "FB_KITCHEN" ||
    role === "CHEF"
  );
}



const postSchema = z.object({
  outletId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(BUFFET_MEALS),
  actorLabel: z.string().min(1).max(120),
  actorUserId: z.string().min(1).nullable().optional(),
  eaterId: z.string().min(1).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/buffet/management-meals", async (httpReq, httpRes) => {
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
    const outletId = url.searchParams.get("outletId");
    if (!outletId) return sendJson(httpRes, { error: "outletId required" }, 400);
    const mealRaw = url.searchParams.get("meal");
    const meal =
      mealRaw && (BUFFET_MEALS as readonly string[]).includes(mealRaw)
        ? (mealRaw as (typeof BUFFET_MEALS)[number])
        : undefined;
    const meals = await listManagementMeals({
      outletId,
      fromYmd: url.searchParams.get("from") ?? undefined,
      toYmd: url.searchParams.get("to") ?? undefined,
      meal,
    });
    return sendJson(httpRes, { meals });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "OUTLET_NOT_FOUND"
    ) {
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
  http.post("/api/admin/buffet/management-meals", async (httpReq, httpRes) => {
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
    const body = postSchema.parse(httpReq.body);
    const meal = await signManagementMeal({
      outletId: body.outletId,
      serviceDateYmd: body.serviceDate,
      meal: body.meal,
      actorLabel: body.actorLabel,
      actorUserId: body.actorUserId,
      signedByUserId: session?.sub ?? null,
      notes: body.notes,
      eaterId: body.eaterId,
      allowPastEdit: canEditPastManagement(session),
    });
    return sendJson(httpRes, meal, 201);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "OUTLET_NOT_FOUND") return sendJson(httpRes, { error: "Outlet not found" }, 404);
      if (code === "ACTOR_REQUIRED") return sendJson(httpRes, { error: "Actor name required" }, 400);
      if (code === "DAY_LOCKED") {
        return sendJson(httpRes, { error: "Past buffet days are locked" }, 403);
      }
      if (code === "ALREADY_SIGNED") {
        return sendJson(httpRes, { error: "This person already signed for that meal" }, 409);
      }
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
