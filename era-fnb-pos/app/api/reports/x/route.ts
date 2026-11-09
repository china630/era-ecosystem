import { z } from "zod";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { buildXReport } from "@/lib/nafta-x-report";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { getSatelliteSession } from "@/lib/session";

const querySchema = z.object({
  outletId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_SALES);
    if (denied) return denied;
    const url = new URL(request.url);
    const q = querySchema.parse({
      outletId: url.searchParams.get("outletId") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });
    const outletId = q.outletId ?? (await getSelectedOutletId());
    if (!outletId) return jsonError("Select an outlet", 400);
    const report = await buildXReport(outletId, q.date ?? todayBakuYmd());
    if (!report) return jsonError("Outlet not found", 404);
    return jsonOk(report);
  } catch (err) {
    return handleRouteError(err);
  }
}
