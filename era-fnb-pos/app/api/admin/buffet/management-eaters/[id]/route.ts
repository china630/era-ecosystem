import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { patchManagementEater } from "@/lib/buffet-management-eaters.service";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  included: z.boolean().optional(),
  displayLabel: z.string().min(1).max(200).optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const eaters = await patchManagementEater(id, body);
    return jsonOk({ eaters });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "EATER_NOT_FOUND"
    ) {
      return jsonError("Eater not found", 404);
    }
    return handleRouteError(err);
  }
}
