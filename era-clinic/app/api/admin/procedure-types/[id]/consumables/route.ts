import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  listProcedureConsumableLines,
  replaceProcedureConsumableLines,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  sku: z.string().min(1),
  financeProductId: z.string().nullable().optional(),
  qtyPerSession: z.number().positive().optional(),
  wasteFactor: z.number().min(0).optional(),
});

const putSchema = z.object({
  lines: z.array(lineSchema),
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
    return jsonOk(await listProcedureConsumableLines(id));
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
    const rows = await replaceProcedureConsumableLines(id, body.lines);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "procedureConsumableLine",
      id,
      "REPLACE",
      body,
    );
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
