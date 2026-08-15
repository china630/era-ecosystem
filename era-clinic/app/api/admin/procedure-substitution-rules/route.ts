import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRead, assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  createSubstitutionRule,
  deleteSubstitutionRule,
  listSubstitutionRules,
} from "@/lib/procedure-substitution.service";

const createSchema = z.object({
  originalCode: z.string().min(1),
  substituteCode: z.string().min(1),
  note: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const guard = await assertClinicAdminRead();
    if (guard.error) return guard.error;
    return jsonOk(await listSubstitutionRules());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    return jsonOk(await createSubstitutionRule(body), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    await deleteSubstitutionRule(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
