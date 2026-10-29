import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { syncGuestNightsFromHotel } from "@/lib/buffet-guest-nights.service";

const bodySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outletId: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = bodySchema.parse(await request.json());
    const result = await syncGuestNightsFromHotel({
      fromYmd: body.from,
      toYmd: body.to,
      outletId: body.outletId,
    });
    return jsonOk(result);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "DATE_ORDER") return jsonError("from must be on or before to", 400);
      if (code === "HOTEL_UNAVAILABLE") {
        return jsonError("Hotel guest-nights pull failed — use Manual", 503);
      }
    }
    return handleRouteError(err);
  }
}
