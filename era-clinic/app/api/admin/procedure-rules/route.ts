import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  listProcedureRules,
  createProcedureRule,
  deleteProcedureRule,
} from "@/lib/procedure-rules.service";

const createSchema = z.object({
  beforeCode: z.string().min(1),
  afterCode: z.string().min(1),
  kind: z.enum(["SEQUENCE_GAP", "MUTUAL_EXCLUSION"]).optional(),
  minGapMinutes: z.number().int().nonnegative().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    return jsonOk(await listProcedureRules());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    return jsonOk(await createProcedureRule(body), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonOk({ error: "id required" }, 400);
    await deleteProcedureRule(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
