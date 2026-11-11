import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS, ROLE_CODES } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { deleteManagementMeal } from "@/lib/buffet-management-meals.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type Ctx = { params: Promise<{ id: string }> };

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.delete("/api/admin/buffet/management-meals/:id", async (httpReq, httpRes) => {
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
    const { id } = httpReq.params;
    return sendJson(httpRes, 
      await deleteManagementMeal(id, {
        allowPastEdit: canEditPastManagement(session),
      }),
    );
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "MEAL_NOT_FOUND") return sendJson(httpRes, { error: "Management meal not found" }, 404);
      if (code === "DAY_LOCKED") return sendJson(httpRes, { error: "Past buffet days are locked" }, 403);
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
