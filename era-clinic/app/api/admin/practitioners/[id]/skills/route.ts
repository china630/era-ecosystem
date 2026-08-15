import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  getPractitionerById,
  listPractitionerSkills,
  setPractitionerSkills,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";

const putSchema = z.object({
  procedureTypeIds: z.array(z.string().min(1)),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const existing = await getPractitionerById(id);
    if (!existing) return jsonError("Not found", 404);
    return jsonOk(await listPractitionerSkills(id));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const existing = await getPractitionerById(id);
    if (!existing) return jsonError("Not found", 404);
    const body = putSchema.parse(await req.json());
    const rows = await setPractitionerSkills(id, body.procedureTypeIds);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitionerSkill",
      id,
      "REPLACE",
      body,
    );
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
