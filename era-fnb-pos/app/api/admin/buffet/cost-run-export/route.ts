import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { exportBuffetCostRunSlice } from "@/lib/buffet-cost-run-export.service";

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
    return jsonOk(slice);
  } catch (err) {
    return mapExportError(err) ?? handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = bodySchema.parse(await request.json());
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
    return jsonOk(slice);
  } catch (err) {
    return mapExportError(err) ?? handleRouteError(err);
  }
}
