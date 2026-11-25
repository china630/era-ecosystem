/** Lifted from nest/generated/admin_buffet_management-meals__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS, ROLE_CODES } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { deleteManagementMeal } from "@/lib/buffet-management-meals.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class AdminBuffetManagementMealsIdController {
  @Delete("api/admin/buffet/management-meals/:id")
  @HttpCode(200)
  async delete_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
