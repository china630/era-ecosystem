import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  createRotationRule,
  deleteRotationRule,
  listRotationRules,
  updateRotationRule,
} from "@/lib/procedure-rotation.service";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  memberCodes: z.array(z.string().min(1)).min(1),
  scope: z.enum(["BODY_PART", "GROUP"]).default("GROUP"),
  maxConsecutiveDays: z.number().int().min(1).max(14).default(1),
  restProcedureCode: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    return jsonOk(await listRotationRules());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    return jsonOk(await createRotationRule(body), 201);
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
    await deleteRotationRule(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
