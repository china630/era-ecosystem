import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import {
  createManualEater,
  listManagementEaters,
  syncManagementEatersFromHr,
} from "@/lib/buffet-management-eaters.service";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const outletId = new URL(request.url).searchParams.get("outletId");
    const eaters = await listManagementEaters(outletId || undefined);
    return jsonOk({ eaters });
  } catch (err) {
    return handleRouteError(err);
  }
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sync"),
    outletId: z.string().min(1).nullable().optional(),
  }),
  z.object({
    action: z.literal("manual"),
    displayLabel: z.string().min(1).max(200),
    outletId: z.string().min(1).nullable().optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = postSchema.parse(await request.json());
    if (body.action === "sync") {
      const result = await syncManagementEatersFromHr(body.outletId);
      return jsonOk(result);
    }
    const eaters = await createManualEater({
      displayLabel: body.displayLabel,
      outletId: body.outletId,
    });
    return jsonOk({ eaters }, 201);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "ORCH_UNAVAILABLE") {
        return jsonError("Workforce leadership sync unavailable", 503);
      }
      if (code === "LABEL_REQUIRED") return jsonError("Label required", 400);
    }
    return handleRouteError(err);
  }
}
