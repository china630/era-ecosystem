import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  listProcedureTypeRequirements,
  replaceProcedureTypeRequirements,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";
import { prisma } from "@/lib/prisma";

const requirementSchema = z.object({
  role: z.enum(["LOCATION", "EQUIPMENT", "STAFF"]),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  staffMode: z.enum(["HARD", "SOFT"]).optional(),
  required: z.boolean().optional(),
});

const putSchema = z.object({
  requirements: z.array(requirementSchema),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const existing = await prisma.procedureType.findUnique({ where: { id } });
    if (!existing) return jsonError("Not found", 404);
    return jsonOk(await listProcedureTypeRequirements(id));
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
    const existing = await prisma.procedureType.findUnique({ where: { id } });
    if (!existing) return jsonError("Not found", 404);
    const body = putSchema.parse(await req.json());
    const rows = await replaceProcedureTypeRequirements(id, body.requirements);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "procedureTypeRequirement",
      id,
      "REPLACE",
      body,
    );
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
