import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS, ROLE_CODES } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { deleteManagementMeal } from "@/lib/buffet-management-meals.service";

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

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    return jsonOk(
      await deleteManagementMeal(id, {
        allowPastEdit: canEditPastManagement(session),
      }),
    );
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "MEAL_NOT_FOUND") return jsonError("Management meal not found", 404);
      if (code === "DAY_LOCKED") return jsonError("Past buffet days are locked", 403);
    }
    return handleRouteError(err);
  }
}
