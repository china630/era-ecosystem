import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { deleteDaySeries, listDaySeries, saveDaySeries } from "@/domain/planning/day-series.service";

const bodySchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  fillsRestDays: z.boolean().default(false),
  members: z.array(z.object({ procedureCode: z.string().min(1), shortMark: z.string().min(1) })).default([]),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    return jsonOk(await listDaySeries());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = bodySchema.parse(await req.json());
    return jsonOk(await saveDaySeries(body));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    await deleteDaySeries(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
