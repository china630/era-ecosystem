import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { spawnWeekFromTemplate } from "@/lib/buffet-week-template.service";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skipExisting: z.boolean().optional(),
  coversSource: z.enum(["MANUAL", "HOTEL"]).optional(),
  coversAdult: z.number().int().min(0).max(50000).optional(),
  coversChild: z.number().int().min(0).max(50000).optional(),
  productionFactorPct: z.number().min(0).max(100).optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const result = await spawnWeekFromTemplate(id, body.weekStart, {
      skipExisting: body.skipExisting,
      coversSource: body.coversSource,
      coversAdult: body.coversAdult,
      coversChild: body.coversChild,
      productionFactorPct: body.productionFactorPct,
    });
    return jsonOk(result, 201);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "TEMPLATE_NOT_FOUND") return jsonError("Template not found", 404);
      if (code === "TEMPLATE_EMPTY") {
        return jsonError("Template has no slots — add Mon–Sun meals first", 400);
      }
      if (code === "PLAN_SLOT_TAKEN") {
        return NextResponse.json(
          {
            error: "A plan already exists for a template slot",
            code: "PLAN_SLOT_TAKEN",
            serviceDate: (err as { serviceDate?: string }).serviceDate,
            meal: (err as { meal?: string }).meal,
          },
          { status: 409 },
        );
      }
    }
    return handleRouteError(err);
  }
}
