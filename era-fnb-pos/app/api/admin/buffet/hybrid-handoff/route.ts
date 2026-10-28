import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { buildHybridHandoffPack } from "@/lib/buffet-hybrid-handoff.service";

/**
 * F&B → Finance HYBRID handoff pack (Phase A).
 * POS sale/COMP + staff net + Forecast theoretical → financeHandoffQuery.
 */
const querySchema = z.object({
  outletId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffGrossAzn: z.coerce.number().min(0).optional(),
});

function mapHandoffError(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "OUTLET_NOT_FOUND") return jsonError("Outlet not found", 404);
    if (code === "INVALID_DATE_RANGE" || code === "DATE_ORDER" || code === "BAD_DATE") {
      return jsonError("from must be on or before to (YYYY-MM-DD)", 400);
    }
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      outletId: url.searchParams.get("outletId"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      staffGrossAzn: url.searchParams.get("staffGrossAzn") ?? undefined,
    });
    if (parsed.from > parsed.to) {
      return jsonError("from must be on or before to (YYYY-MM-DD)", 400);
    }
    const staffOverride = url.searchParams.has("staffGrossAzn");
    const pack = await buildHybridHandoffPack({
      outletId: parsed.outletId,
      fromYmd: parsed.from,
      toYmd: parsed.to,
      staffGrossAzn: parsed.staffGrossAzn,
      staffGrossOverride: staffOverride,
      financeWebUrl: process.env.NEXT_PUBLIC_FINANCE_WEB_URL ?? null,
    });
    return jsonOk(pack);
  } catch (err) {
    return mapHandoffError(err) ?? handleRouteError(err);
  }
}
